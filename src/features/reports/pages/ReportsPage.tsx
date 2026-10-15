import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  consumptionApi,
  homesApi,
  reportsApi,
  tariffApi,
  type GeneratedReport,
} from '@shared/http/httpClient';
import { Download } from 'lucide-react';
import { formatCurrency } from '@shared/i18n/locale';
import { useAuth } from '@app/providers/AuthProvider';
import { localDate } from '@shared/lib/dates';

type Home = {
  id: string;
  name: string;
  usageType?: 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL';
  tier?: number | null;
};
type ReportData = { totalM3?: number; totalCost?: number; readingCount?: number };
type ReportTariff = {
  usageType?: 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL';
  tier?: number | null;
  m3Value?: number;
  basicM3Value?: number;
  excessM3Value?: number;
  referenceConsumptionM3?: number;
  basicLimitM3?: number;
  fixedCharge?: number;
  rateSource?: string;
  unitBilling?: string;
  unitSensor?: string;
  year?: number;
  month?: number;
  source?: string;
};

export function ReportsAnalytics({ homeId }: { homeId?: string }) {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const [homes, setHomes] = useState<Home[]>([]);
  const [selectedHomeId, setSelectedHomeId] = useState(homeId || '');
  const [summary, setSummary] = useState<ReportData>({});
  const [tariff, setTariff] = useState<ReportTariff | null>(null);
  const [monthly, setMonthly] = useState<Array<{ month: string; liters: number }>>([]);
  const [segments, setSegments] = useState<Array<{ location: string; consumptionM3: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null);
  const [history, setHistory] = useState<GeneratedReport[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  useEffect(() => {
    homesApi
      .list()
      .then(({ data }) => {
        const loaded = (
          data as Array<{
            homeId: string;
            name: string;
            usageType?: 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL';
            tier?: number;
          }>
        ).map((home) => ({
          id: String(home.homeId),
          name: String(home.name),
          usageType: home.usageType,
          tier: home.tier,
        }));
        setHomes(loaded);
        setSelectedHomeId((current) => current || loaded[0]?.id || '');
      })
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : t('reports.homesLoadError'))
      );
  }, [t]);

  useEffect(() => {
    if (homeId) setSelectedHomeId(homeId);
  }, [homeId]);

  useEffect(() => {
    if (!selectedHomeId) return;
    const now = new Date();
    const from = localDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const threeMonthFrom = localDate(new Date(now.getFullYear(), now.getMonth() - 2, 1));
    const to = localDate(now);
    setLoading(true);
    Promise.all([
      consumptionApi
        .summary(new URLSearchParams({ homeId: selectedHomeId, from, to }).toString())
        .catch(() => ({ data: null })),
      tariffApi.currentByHome(selectedHomeId).catch(() => ({ data: null })),
      consumptionApi
        .advanced(
          new URLSearchParams({
            homeId: selectedHomeId,
            from: threeMonthFrom,
            to,
            groupBy: 'monthly',
          }).toString()
        )
        .catch(() => ({ data: { points: [] } })),
      consumptionApi
        .advanced(
          new URLSearchParams({ homeId: selectedHomeId, from, to, groupBy: 'location' }).toString()
        )
        .catch(() => ({ data: { points: [] } })),
    ])
      .then(([summaryResponse, tariffResponse, monthlyResponse, segmentResponse]) => {
        const apiSummary = summaryResponse.data as ReportData | null;
        const apiTariff = tariffResponse.data as ReportTariff | null;
        const monthlyPoints = monthlyResponse.data.points || [];
        const monthlyByKey = new Map(
          monthlyPoints.map((point) => [point.bucketDate || point.groupKey, point])
        );
        const realMonthly = Array.from({ length: 3 }, (_, index) => {
          const date = new Date(now.getFullYear(), now.getMonth() - (2 - index), 1);
          const key = localDate(date);
          const point = monthlyByKey.get(key);
          return {
            month: date.toLocaleDateString(i18n.language, { month: 'short' }),
            liters: Number(point?.consumptionLiters || 0),
          };
        });
        setSummary(apiSummary || {});
        setTariff(apiTariff);
        setMonthly(realMonthly);
        setSegments(
          (segmentResponse.data.points || []).map((point) => ({
            location: point.location || point.groupKey,
            consumptionM3: Number(point.consumptionM3 || 0),
          }))
        );
      })
      .catch((error) => {
        setSummary({});
        setTariff(null);
        setMonthly([]);
        setSegments([]);
        toast.error(error instanceof Error ? error.message : t('reports.loadError'));
      })
      .finally(() => setLoading(false));
  }, [i18n.language, selectedHomeId, t]);

  useEffect(() => {
    if (!selectedHomeId) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    reportsApi
      .history(selectedHomeId, { pageSize: 10 })
      .then(({ data }) => setHistory(data))
      .catch((error) => {
        setHistory([]);
        toast.error(error instanceof Error ? error.message : t('reports.historyLoadError'));
      })
      .finally(() => setHistoryLoading(false));
  }, [historyRefresh, selectedHomeId, t]);

  const currentM3 = Number(summary.totalM3 || 0);
  const rate = Number(tariff?.m3Value || 0);
  const selectedHome = useMemo(
    () => homes.find((home) => home.id === selectedHomeId),
    [homes, selectedHomeId]
  );

  const downloadReport = async (format: 'pdf' | 'excel') => {
    if (!selectedHomeId) return;
    const now = new Date();
    const from = localDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = localDate(now);
    setDownloading(format);
    try {
      const query = new URLSearchParams({ homeId: selectedHomeId, from, to }).toString();
      const blob =
        format === 'pdf'
          ? await reportsApi.downloadConsumptionPdf(query)
          : await reportsApi.downloadConsumptionExcel(query);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hidro-smart-consumo-${from}-${to}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(t(format === 'pdf' ? 'reports.pdfDownloaded' : 'reports.excelDownloaded'));
      setHistoryRefresh((current) => current + 1);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t(format === 'pdf' ? 'reports.pdfDownloadError' : 'reports.excelDownloadError')
      );
    } finally {
      setDownloading(null);
    }
  };

  const downloadStoredReport = async (report: GeneratedReport) => {
    try {
      const blob = await reportsApi.downloadStored(report.reportId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hidro-smart-reporte-${report.reportId}.${report.type === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('reports.historyDownloadError'));
    }
  };

  return (
    <div className="mobile-reports-page space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl text-gray-900">{t('reports.title')}</h2>
          <p className="text-gray-600">{t('reports.subtitle')}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto">
          <select
            className="h-10 w-full rounded-md border px-3 sm:w-auto sm:min-w-56"
            value={selectedHomeId}
            onChange={(event) => setSelectedHomeId(event.target.value)}
            aria-label={t('homes.home')}
          >
            <option value="">{t('homes.selectHome')}</option>
            {homes.map((home) => (
              <option key={home.id} value={home.id}>
                {home.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.title')}</CardTitle>
          <CardDescription>{selectedHome?.name || t('homes.home')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">{t('reports.dataSourceNotice')}</p>
          <div className="mobile-report-actions grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => void downloadReport('pdf')}
              disabled={!selectedHomeId || downloading !== null}
            >
              <Download aria-hidden="true" />
              {downloading === 'pdf' ? t('reports.downloadingPdf') : t('reports.downloadPdf')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => void downloadReport('excel')}
              disabled={!selectedHomeId || downloading !== null}
            >
              <Download aria-hidden="true" />
              {downloading === 'excel' ? t('reports.downloadingExcel') : t('reports.downloadExcel')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>{t('reports.currentConsumption')}</CardDescription>
            <CardTitle>{loading ? '—' : `${currentM3} m³`}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              {summary.readingCount || 0} {t('reports.readings')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t('reports.waterRate')}</CardDescription>
            <CardTitle>
              {rate ? formatCurrency(rate, i18n.language, session?.preferences?.currency) : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              {tariff?.fixedCharge
                ? `${t('reports.fixedCharge')}: ${formatCurrency(tariff.fixedCharge, i18n.language, session?.preferences?.currency)}`
                : t('reports.noCurrentRate')}
            </p>
            {tariff && (
              <p className="mt-1 text-xs text-gray-500">
                {tariff.rateSource === 'NATIONAL_FALLBACK'
                  ? t('reports.nationalReferenceRate')
                  : t('reports.providerRate')}
                {tariff.referenceConsumptionM3
                  ? ` · ${t('reports.referenceConsumption')}: ${tariff.referenceConsumptionM3} m³`
                  : ''}
              </p>
            )}
            {tariff?.year && tariff.month && (
              <p className="mt-1 text-xs text-gray-500">
                {tariff.year}-{String(tariff.month).padStart(2, '0')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.historicalComparison')}</CardTitle>
          <CardDescription>{t('reports.databaseMonthlyNotice')}</CardDescription>
        </CardHeader>
        <CardContent>
          {monthly.length ? (
            <div className="mobile-inline-grid grid grid-cols-3 gap-2 sm:gap-3">
              {monthly.map((item) => (
                <div key={item.month} className="rounded-lg border p-3 text-center">
                  <div className="text-sm text-gray-600">{item.month}</div>
                  <div className="mt-1 text-base sm:text-xl">
                    {(item.liters / 1000).toFixed(2)} m³
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('reports.noMonthlyReadings')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.consumptionBySegment')}</CardTitle>
          <CardDescription>{t('reports.monthlyConsumptionDistribution')}</CardDescription>
        </CardHeader>
        <CardContent>
          {segments.length ? (
            <div className="space-y-4">
              {segments.map((segment) => {
                const percentage = currentM3 > 0 ? (segment.consumptionM3 / currentM3) * 100 : 0;
                return (
                  <div key={segment.location} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{segment.location}</span>
                      <span>
                        {segment.consumptionM3.toFixed(3)} m³ · {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('reports.noSegmentReadings')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.historyTitle')}</CardTitle>
          <CardDescription>{t('reports.historyDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <p className="text-sm text-gray-500">{t('reports.historyLoading')}</p>
          ) : history.length ? (
            <div className="space-y-2">
              {history.map((report) => (
                <div
                  key={report.reportId}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {report.type === 'pdf'
                        ? t('reports.reportTypePdf')
                        : t('reports.reportTypeExcel')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {report.periodStart || '—'} {report.periodEnd ? `→ ${report.periodEnd}` : ''}{' '}
                      · {new Date(report.createdAt).toLocaleString(i18n.language)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={report.status !== 'Ready'}
                    onClick={() => void downloadStoredReport(report)}
                  >
                    <Download aria-hidden="true" />
                    {report.status === 'Ready'
                      ? t('reports.downloadStored')
                      : t(`reports.status${report.status}`)}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('reports.historyEmpty')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
