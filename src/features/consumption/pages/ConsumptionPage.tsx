import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, CalendarDays, Droplets, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { consumptionApi, type ConsumptionSummary } from '@shared/http/apiClient';
import { WeeklyConsumptionChart } from '@features/consumption/charts/WeeklyConsumptionChart';
import { formatCurrency } from '@shared/i18n/locale';
import { useAuth } from '@app/providers/AuthProvider';
import { localDate } from '@shared/lib/dates';

type DailyPoint = { day: string; consumption: number };

function query(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

export function ConsumptionPage({ homeId }: { homeId?: string }) {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const [selectedDate, setSelectedDate] = useState(localDate(new Date()));
  const [summary, setSummary] = useState<ConsumptionSummary | null>(null);
  const [weekly, setWeekly] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestInFlightRef = useRef(false);
  const viewKeyRef = useRef('');
  viewKeyRef.current = `${homeId || ''}:${selectedDate}`;

  const range = useMemo(() => {
    const end = new Date(`${selectedDate}T12:00:00`);
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6, 12);
    return { from: localDate(start), to: selectedDate };
  }, [selectedDate]);

  const load = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!homeId || requestInFlightRef.current) return;
    const requestKey = `${homeId}:${selectedDate}`;
    requestInFlightRef.current = true;
    if (!silent) setLoading(true);
    setError(false);
    try {
      const dates = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(`${selectedDate}T12:00:00`);
        date.setDate(date.getDate() - (6 - index));
        return date;
      });
      const [summaryResponse, dailyResponse] = await Promise.all([
        consumptionApi.summary(query({ homeId, from: range.from, to: range.to })),
        consumptionApi.advanced(
          query({ homeId, from: range.from, to: range.to, groupBy: 'daily' })
        ),
      ]);
      if (viewKeyRef.current !== requestKey) return;
      setSummary(summaryResponse.data);
      const dailyByDate = new Map(
        (dailyResponse.data.points || []).map((point) => [
          point.bucketDate ? point.bucketDate.slice(0, 10) : point.groupKey,
          point,
        ])
      );
      setWeekly(
        dates.map((date) => ({
          day: date.toLocaleDateString(i18n.language, { weekday: 'short' }),
          consumption: dailyByDate.get(localDate(date))?.consumptionM3 || 0,
        }))
      );
    } catch (loadError) {
      if (!silent && viewKeyRef.current === requestKey) {
        setSummary(null);
        setWeekly([]);
        setError(true);
        toast.error(loadError instanceof Error ? loadError.message : t('consumption.loadError'));
      }
    } finally {
      requestInFlightRef.current = false;
      if (!silent && viewKeyRef.current === requestKey) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const refreshTimer = window.setInterval(() => {
      void load({ silent: true });
    }, 5000);

    return () => window.clearInterval(refreshTimer);
  }, [homeId, selectedDate, i18n.language]);

  if (!homeId) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-gray-600">
          {t('consumption.selectHome')}
        </CardContent>
      </Card>
    );
  }

  const totalM3 = Number(summary?.totalM3 || 0);
  const totalLiters = Number(summary?.totalLiters || 0);
  const readingCount = Number(summary?.readingCount || 0);
  const cost = summary?.totalCost;
  const resetDate = () => {
    const today = localDate(new Date());
    if (selectedDate === today) {
      void load();
      return;
    }
    setSelectedDate(today);
  };

  return (
    <div className="mobile-consumption-page min-w-0 space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">{t('consumption.title')}</h2>
          <p className="text-gray-600">{t('consumption.subtitle')}</p>
        </div>
        <div className="flex w-full items-end gap-2 sm:w-auto">
          <label className="grid min-w-0 flex-1 gap-1 text-sm text-gray-700 sm:w-56 sm:flex-none">
            <span className="flex items-center gap-1">
              <CalendarDays className="size-4" />
              {t('consumption.endDate')}
            </span>
            <input
              className="h-11 w-full rounded-md border bg-background px-3"
              type="date"
              value={selectedDate}
              max={localDate(new Date())}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            className="consumption-reset-button shrink-0 self-end"
            onClick={resetDate}
            aria-label={t('common.reset')}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            <span>{t('common.reset')}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {t('consumption.loadError')}
        </div>
      )}

      <div className="mobile-consumption-metrics grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>{t('consumption.periodTotal')}</CardDescription>
            <CardTitle>{loading ? '—' : `${totalM3.toFixed(2)} m³`}</CardTitle>
          </CardHeader>
          <CardContent>
            <Droplets className="size-5 text-blue-600" />
          </CardContent>
        </Card>
        <Card className="consumption-secondary-metric">
          <CardHeader>
            <CardDescription>{t('consumption.liters')}</CardDescription>
            <CardTitle>{loading ? '—' : `${totalLiters.toFixed(1)} L`}</CardTitle>
          </CardHeader>
          <CardContent>
            <Droplets className="size-5 text-cyan-600" />
          </CardContent>
        </Card>
        <Card className="consumption-secondary-metric">
          <CardHeader>
            <CardDescription>{t('consumption.readings')}</CardDescription>
            <CardTitle>{loading ? '—' : readingCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <Activity className="size-5 text-emerald-600" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t('consumption.cost')}</CardDescription>
            <CardTitle>
              {loading || cost == null
                ? '—'
                : formatCurrency(Number(cost), i18n.language, session?.preferences?.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{t('consumption.backendCalculated')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mobile-consumption-charts grid grid-cols-1 gap-4 sm:gap-5">
        <Card>
          <CardHeader>
            <CardTitle>{t('consumption.dailyTitle')}</CardTitle>
            <CardDescription>{t('consumption.dailyDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="h-[270px]">
            {weekly.length ? (
              <WeeklyConsumptionChart points={weekly} />
            ) : (
              <p className="py-8 text-sm text-gray-500">{t('consumption.noData')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
