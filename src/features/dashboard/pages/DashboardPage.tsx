import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import {
  Droplets,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Wifi,
  WifiOff,
  CircleHelp,
  Battery,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { DailyConsumptionChart } from '@features/consumption/charts/DailyConsumptionChart';
import { WeeklyConsumptionChart } from '@features/consumption/charts/WeeklyConsumptionChart';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { alertsApi, consumptionApi, devicesApi } from '@shared/http/httpClient';
import type { AlertEvent, DeviceTelemetry } from '@shared/http/httpClient';

interface DashboardHomeProps {
  homeId?: string;
}

async function optionalDashboardRequest<T>(request: Promise<T>, label: string): Promise<T | null> {
  let timedOut = false;
  let timeoutId: number | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timeoutId = window.setTimeout(() => {
        timedOut = true;
        resolve(null);
      }, 4000);
    });
    const result = await Promise.race([request, timeout]);
    if (timedOut) console.warn(`[Dashboard] Tiempo de espera agotado para ${label}`);
    return result;
  } catch (error) {
    console.warn(`[Dashboard] No se pudo actualizar ${label}`, error);
    return null;
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

// RNF1.2 - Tiempos de respuesta menores a 3 segundos
// RNF4.3 - Notificaciones en tiempo real
// RF14 - Monitoreo en tiempo real
export function DashboardHome({ homeId }: DashboardHomeProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentConsumption, setCurrentConsumption] = useState({
    today: 0,
    week: 0,
    month: 0,
    realTime: 0,
  });
  const [devices, setDevices] = useState<
    Array<{
      id: string;
      name: string;
      status: string;
      lastConnectionAt?: string;
      currentFlowLpm?: number | null;
    }>
  >([]);
  const [alerts, setAlerts] = useState<
    Array<{ id: string; type: string; message: string; time: string }>
  >([]);
  const [pendingAlertCount, setPendingAlertCount] = useState(0);
  const [hourlyPoints, setHourlyPoints] = useState<
    Array<{ hour: number; averageConsumptionM3: number }>
  >([]);
  const [weeklyPoints, setWeeklyPoints] = useState<Array<{ day: string; consumption: number }>>([]);
  const [comparisons, setComparisons] = useState<{ today: number | null; week: number | null }>({
    today: null,
    week: null,
  });
  const [monthlyProjection, setMonthlyProjection] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const requestInFlightRef = useRef(false);
  const currentHomeIdRef = useRef(homeId);
  const loadedHomeIdRef = useRef<string | undefined>(undefined);
  currentHomeIdRef.current = homeId;

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      setRefreshTick((current) => current + 1);
    }, 5000);

    return () => window.clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    let active = true;
    if (!homeId) {
      loadedHomeIdRef.current = undefined;
      setIsLoading(false);
      return () => {
        active = false;
      };
    }
    if (requestInFlightRef.current) {
      return () => {
        active = false;
      };
    }

    requestInFlightRef.current = true;
    if (loadedHomeIdRef.current !== homeId) setIsLoading(true);
    setHasLoadError(false);
    const now = new Date();
    const iso = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysFromMonday);
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(weekStart.getDate() - 7);
    const previousWeekEnd = new Date(weekStart);
    previousWeekEnd.setDate(weekStart.getDate() - 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const elapsedMonthDays = now.getDate();
    const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return date;
    });
    Promise.all([
      optionalDashboardRequest(
        consumptionApi.summary(
          new URLSearchParams({ homeId, from: iso(now), to: iso(now) }).toString()
        ),
        'consumo de hoy'
      ),
      optionalDashboardRequest(
        consumptionApi.summary(
          new URLSearchParams({ homeId, from: iso(weekStart), to: iso(now) }).toString()
        ),
        'consumo semanal'
      ),
      optionalDashboardRequest(
        consumptionApi.summary(
          new URLSearchParams({ homeId, from: iso(monthStart), to: iso(now) }).toString()
        ),
        'consumo mensual'
      ),
      optionalDashboardRequest(
        consumptionApi.summary(
          new URLSearchParams({ homeId, from: iso(yesterday), to: iso(yesterday) }).toString()
        ),
        'comparación diaria'
      ),
      optionalDashboardRequest(
        consumptionApi.summary(
          new URLSearchParams({
            homeId,
            from: iso(previousWeekStart),
            to: iso(previousWeekEnd),
          }).toString()
        ),
        'comparación semanal'
      ),
      optionalDashboardRequest(
        consumptionApi.advanced(
          new URLSearchParams({
            homeId,
            from: iso(now),
            to: iso(now),
            groupBy: 'hourly',
          }).toString()
        ),
        'gráfico diario'
      ),
      optionalDashboardRequest(devicesApi.list(homeId), 'dispositivos'),
      optionalDashboardRequest(alertsApi.pending(homeId), 'alertas pendientes'),
      optionalDashboardRequest(
        alertsApi.history(homeId, 'status=Pending&pageSize=5'),
        'historial de alertas'
      ),
      optionalDashboardRequest(
        consumptionApi.advanced(
          new URLSearchParams({
            homeId,
            from: iso(weekStart),
            to: iso(now),
            groupBy: 'daily',
          }).toString()
        ),
        'gráfico semanal'
      ),
    ])
      .then(
        async ([
          today,
          week,
          month,
          yesterdayResponse,
          previousWeekResponse,
          hourly,
          deviceResponse,
          alertResponse,
          alertHistoryResponse,
          dailyResponse,
        ]) => {
          if (!active || currentHomeIdRef.current !== homeId) return;
          const getTotal = (response: { data: unknown } | null) =>
            Number((response?.data as { totalM3?: number } | undefined)?.totalM3 || 0);
          const todayTotal = getTotal(today);
          const weekTotal = getTotal(week);
          const monthTotal = getTotal(month);
          const yesterdayTotal = getTotal(yesterdayResponse);
          const previousWeekTotal = getTotal(previousWeekResponse);
          const percentageChange = (current: number, previous: number) =>
            previous > 0 ? ((current - previous) / previous) * 100 : null;
          if (hourly) {
            const hourlyByHour = new Map(
              hourly.data.points.map((point) => [
                point.bucketHour ?? Number(point.groupKey),
                point.consumptionM3,
              ])
            );
            setHourlyPoints(
              Array.from({ length: 24 }, (_, hour) => ({
                hour,
                averageConsumptionM3: Number(hourlyByHour.get(hour) || 0),
              }))
            );
          }
          setCurrentConsumption((current) => ({
            ...current,
            today: today ? todayTotal : current.today,
            week: week ? weekTotal : current.week,
            month: month ? monthTotal : current.month,
          }));
          if (today && yesterdayResponse) {
            setComparisons((current) => ({
              ...current,
              today: percentageChange(todayTotal, yesterdayTotal),
            }));
          }
          if (week && previousWeekResponse) {
            setComparisons((current) => ({
              ...current,
              week: percentageChange(weekTotal, previousWeekTotal),
            }));
          }
          if (month) {
            setMonthlyProjection(
              elapsedMonthDays > 0 ? (monthTotal / elapsedMonthDays) * monthDays : null
            );
          }
          if (dailyResponse) {
            const dailyByDate = new Map(
              dailyResponse.data.points.map((point) => [
                point.bucketDate ? point.bucketDate.slice(0, 10) : point.groupKey,
                point,
              ])
            );
            setWeeklyPoints(
              days.map((date) => ({
                day: date.toLocaleDateString(undefined, { weekday: 'short' }),
                consumption: dailyByDate.get(iso(date))?.consumptionM3 || 0,
              }))
            );
          }
          if (deviceResponse) {
            const listedDevices =
              (deviceResponse?.data as Array<{
                deviceId: string;
                name: string;
                status: string;
                connectivityStatus?: string;
                lastConnectionAt?: string;
              }>) || [];
            const devicesWithTelemetry = await Promise.all(
              listedDevices.map(async (device) => {
                const response = await optionalDashboardRequest(
                  devicesApi.latestTelemetry(device.deviceId),
                  `telemetría de ${device.name}`
                );
                return { ...device, latestTelemetry: response?.data as DeviceTelemetry | null };
              })
            );
            const realtimeFlowLpm = devicesWithTelemetry.reduce(
              (total, device) => total + Number(device.latestTelemetry?.flowRateLpm || 0),
              0
            );
            setCurrentConsumption((current) => ({
              ...current,
              realTime: (realtimeFlowLpm * 60) / 1000,
            }));
            setDevices(
              devicesWithTelemetry.map((device) => ({
                id: device.deviceId,
                name: device.name,
                status: ['online', 'offline', 'degraded', 'error', 'unknown'].includes(
                  String(device.connectivityStatus || 'unknown').toLowerCase()
                )
                  ? String(device.connectivityStatus || 'unknown').toLowerCase()
                  : 'unknown',
                lastConnectionAt: device.lastConnectionAt,
                currentFlowLpm: device.latestTelemetry?.flowRateLpm ?? null,
              }))
            );
          }
          const pending = (alertResponse?.data || {}) as {
            pendingCount?: number;
            lastAlertAt?: string | null;
          };
          const count = Number(pending.pendingCount || 0);
          setPendingAlertCount(count);
          setAlerts(
            ((alertHistoryResponse?.data || []) as AlertEvent[]).map((alert) => ({
              id: alert.alertId,
              type: 'warning',
              message: alert.message || t('dashboard.activeAlerts'),
              time: alert.generatedAt ? new Date(alert.generatedAt).toLocaleString() : '',
            }))
          );
        }
      )
      .catch(() => {
        if (!active || currentHomeIdRef.current !== homeId) return;
        setCurrentConsumption({ today: 0, week: 0, month: 0, realTime: 0 });
        setComparisons({ today: null, week: null });
        setMonthlyProjection(null);
        setDevices([]);
        setAlerts([]);
        setPendingAlertCount(0);
        setHourlyPoints([]);
        setWeeklyPoints([]);
        setHasLoadError(true);
      })
      .finally(() => {
        requestInFlightRef.current = false;
        if (active && currentHomeIdRef.current === homeId) {
          loadedHomeIdRef.current = homeId;
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [homeId, t, refreshTick]);

  const MetricValue = ({ value }: { value: number }) => {
    if (isLoading) return '—';
    const decimals = value > 0 && value < 0.01 ? 4 : 2;
    return `${value.toFixed(decimals)} m³`;
  };

  const Comparison = ({ value }: { value: number | null }) => {
    if (isLoading || hasLoadError || value === null) {
      return <span className="text-sm text-gray-600">{t('dashboard.noComparableData')}</span>;
    }
    const isDecrease = value <= 0;
    const TrendIcon = isDecrease ? TrendingDown : TrendingUp;
    return (
      <div className={`flex items-center gap-2 ${isDecrease ? 'text-green-600' : 'text-red-600'}`}>
        <TrendIcon className="size-4" aria-hidden="true" />
        <span className="text-sm">
          {Math.abs(value).toFixed(1)}%{' '}
          {isDecrease
            ? t('dashboard.lessThanPreviousPeriod')
            : t('dashboard.moreThanPreviousPeriod')}
        </span>
      </div>
    );
  };

  return (
    <div className="mobile-dashboard min-w-0 space-y-4 sm:space-y-5 lg:space-y-6">
      {/* RNF2.2 - Tarjetas de resumen con información clara */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardDescription>
              <button
                type="button"
                className="dashboard-card-link"
                onClick={() => navigate('/app/consumption')}
              >
                {t('dashboard.todayConsumption')}
              </button>
            </CardDescription>
            <CardTitle className="text-2xl lg:text-3xl">
              <MetricValue value={currentConsumption.today} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Comparison value={comparisons.today} />
          </CardContent>
        </Card>

        <Card className="hidden hover:shadow-lg transition-shadow sm:block">
          <CardHeader className="pb-3">
            <CardDescription>{t('dashboard.weekConsumption')}</CardDescription>
            <CardTitle className="text-2xl lg:text-3xl">
              <MetricValue value={currentConsumption.week} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Comparison value={comparisons.week} />
          </CardContent>
        </Card>

        <Card className="hidden hover:shadow-lg transition-shadow sm:block">
          <CardHeader className="pb-3">
            <CardDescription>{t('dashboard.monthConsumption')}</CardDescription>
            <CardTitle className="text-2xl lg:text-3xl">
              <MetricValue value={currentConsumption.month} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              {isLoading || hasLoadError || monthlyProjection === null
                ? t('dashboard.noComparableData')
                : t('dashboard.monthlyProjectionValue', { value: monthlyProjection.toFixed(2) })}
            </div>
          </CardContent>
        </Card>

        <Card className="hidden hover:shadow-lg transition-shadow sm:block">
          <CardHeader className="pb-3">
            <CardDescription>{t('dashboard.currentFlow')}</CardDescription>
            <CardTitle className="text-2xl lg:text-3xl flex items-center gap-2">
              <Activity className="size-6 text-blue-600 animate-pulse" aria-hidden="true" />
              {currentConsumption.realTime}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">{t('dashboard.realTimeFlow')}</div>
          </CardContent>
        </Card>
      </div>

      {/* RF18 - Alertas y notificaciones */}
      <Card className="hidden sm:block">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle>{t('dashboard.activeAlerts')}</CardTitle>
              <CardDescription>{t('dashboard.importantSystemNotifications')}</CardDescription>
            </div>
            <Badge variant="destructive" className="h-auto w-fit whitespace-normal">
              {pendingAlertCount} {t('dashboard.activeAlerts')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 sm:p-4 rounded-lg border ${
                  alert.type === 'warning'
                    ? 'bg-orange-50 border-orange-200'
                    : alert.type === 'info'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-green-50 border-green-200'
                }`}
                role="alert"
                aria-live="polite"
              >
                {alert.type === 'warning' && (
                  <AlertTriangle
                    className="size-5 text-orange-600 mt-0.5 flex-shrink-0"
                    aria-hidden="true"
                  />
                )}
                {alert.type === 'info' && (
                  <Battery
                    className="size-5 text-blue-600 mt-0.5 flex-shrink-0"
                    aria-hidden="true"
                  />
                )}
                {alert.type === 'success' && (
                  <CheckCircle2
                    className="size-5 text-green-600 mt-0.5 flex-shrink-0"
                    aria-hidden="true"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm break-words">{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('dashboard.ago')} {alert.time}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  aria-label={t('dashboard.viewDetails')}
                >
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* RF22 - Gráficos de consumo */}
      <div className="dashboard-chart-grid grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="hidden sm:block">
          <CardHeader>
            <CardTitle>{t('dashboard.dailyConsumption')}</CardTitle>
            <CardDescription>{t('dashboard.waterConsumptionPerHour')}</CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <div className="h-60 min-w-0 lg:h-72">
              <DailyConsumptionChart points={hourlyPoints} />
            </div>
          </CardContent>
        </Card>

        <Card
          className="dashboard-weekly-chart cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          role="link"
          tabIndex={0}
          aria-label={t('nav.reports')}
          onClick={() => navigate('/app/reports')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              navigate('/app/reports');
            }
          }}
        >
          <CardHeader>
            <CardTitle>{t('dashboard.weeklyConsumption')}</CardTitle>
            <CardDescription>{t('dashboard.waterConsumptionPerDay')}</CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <div className="h-60 min-w-0 lg:h-72">
              <WeeklyConsumptionChart points={weeklyPoints} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RF14 - Estado de dispositivos */}
      <Card
        className="dashboard-devices cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        role="link"
        tabIndex={0}
        aria-label={t('nav.devices')}
        onClick={() => navigate('/app/devices')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            navigate('/app/devices');
          }
        }}
      >
        <CardHeader>
          <CardTitle>{t('dashboard.iotDeviceStatus')}</CardTitle>
          <CardDescription>{t('dashboard.realTimeMonitoring')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.length === 0 && (
              <p className="text-sm text-gray-600">{t('devices.noDevicesRegistered')}</p>
            )}
            {devices.map((device) => (
              <div
                key={device.id}
                className={`dashboard-device-card is-${device.status} p-4 border rounded-lg space-y-3 hover:shadow-md transition-shadow`}
              >
                <div className="dashboard-device-card-heading flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Droplets className="size-4 text-blue-600 flex-shrink-0" aria-hidden="true" />
                      <span className="dashboard-device-name text-sm truncate">{device.name}</span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      device.status === 'online'
                        ? 'default'
                        : device.status === 'offline'
                          ? 'destructive'
                          : 'outline'
                    }
                    className={`dashboard-device-status is-${device.status} flex-shrink-0`}
                  >
                    {device.status === 'online' ? (
                      <Wifi className="size-3 mr-1" aria-hidden="true" />
                    ) : device.status === 'offline' ? (
                      <WifiOff className="size-3 mr-1" aria-hidden="true" />
                    ) : (
                      <CircleHelp className="size-3 mr-1" aria-hidden="true" />
                    )}
                    {t(`devices.connectivity.${device.status}`)}
                  </Badge>
                </div>

                <div className="dashboard-device-detail flex items-center justify-between text-sm">
                  <span className="text-gray-600">Última conexión</span>
                  <span>
                    {device.lastConnectionAt
                      ? new Date(device.lastConnectionAt).toLocaleString()
                      : 'Sin registro'}
                  </span>
                </div>
                <div className="dashboard-device-flow flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t('dashboard.currentFlow')}</span>
                  <span>
                    {device.currentFlowLpm === null || device.currentFlowLpm === undefined
                      ? 'Sin lectura'
                      : `${device.currentFlowLpm.toFixed(2)} L/min`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
