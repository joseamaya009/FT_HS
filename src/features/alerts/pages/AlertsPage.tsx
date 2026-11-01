import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import {
  alertsApi,
  consumptionApi,
  type AlertRule,
  type AlertThresholdConfiguration,
  type BudgetStatus,
} from '@shared/http/httpClient';
import { useActiveHome } from '@app/providers/ActiveHomeProvider';
import { useTranslation } from 'react-i18next';
import { localeForLanguage } from '@shared/i18n/locale';

type CustomAlertType = Exclude<AlertRule['alertType'], 'daily_limit' | 'monthly_limit'>;

const customAlertOptions: Array<{
  type: CustomAlertType;
  labelKey: string;
  unit: AlertRule['unit'];
  unitLabelKey: string;
}> = [
  { type: 'excessive_consumption', labelKey: 'excessiveConsumption', unit: 'm3_day', unitLabelKey: 'm3Day' },
  { type: 'leak_detected', labelKey: 'possibleLeak', unit: 'minutes', unitLabelKey: 'minutes' },
  { type: 'no_reading', labelKey: 'noSensorReadings', unit: 'minutes', unitLabelKey: 'minutes' },
];

const customRuleTypes = new Set<CustomAlertType>(customAlertOptions.map(({ type }) => type));

export function NotificationsPanel({ homeId }: { homeId?: string }) {
  const { t, i18n } = useTranslation();
  const { homes } = useActiveHome();
  const currentHome = homes.find((home) => home.homeId === homeId);
  const canManage = currentHome?.homeRole !== 'Member' && currentHome?.homeRole !== 'Guest';
  const [alerts, setAlerts] = useState<Array<{
    alertId: string;
    message?: string | null;
    detectedValue?: number | null;
    generatedAt: string;
    status: string;
  }>>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [savedThresholds, setSavedThresholds] = useState<AlertThresholdConfiguration | null>(null);
  const [dailyLimit, setDailyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [thresholdsActive, setThresholdsActive] = useState(true);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [newRuleType, setNewRuleType] = useState<CustomAlertType>('excessive_consumption');
  const [newRuleThreshold, setNewRuleThreshold] = useState('');
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);

  const load = async () => {
    if (!homeId) return;
    setLoading(true);
    try {
      const [history, thresholdResponse, rulesResponse, pending, budget] = await Promise.all([
        alertsApi.history(homeId, 'pageSize=100'),
        alertsApi.thresholds(homeId),
        alertsApi.rules(homeId),
        alertsApi.pending(homeId),
        consumptionApi.budgetStatus(new URLSearchParams({ homeId }).toString()),
      ]);
      const threshold = thresholdResponse.data;
      const loadedRules = rulesResponse.data;
      setAlerts(history.data);
      setRules(loadedRules);
      setSavedThresholds(threshold);
      setDailyLimit(threshold?.dailyLimit == null ? '' : String(threshold.dailyLimit));
      setMonthlyLimit(threshold?.monthlyLimit == null ? '' : String(threshold.monthlyLimit));
      setThresholdsActive(threshold?.active ?? true);
      setPendingCount(pending.data.pendingCount);
      setBudgetStatus(budget.data);
      setRuleDrafts(
        Object.fromEntries(loadedRules.map((rule) => [rule.ruleId, String(rule.threshold)]))
      );
      const available = customAlertOptions.filter(
        ({ type }) => !loadedRules.some((rule) => rule.alertType === type && rule.active)
      );
      if (available.length && !available.some(({ type }) => type === newRuleType)) {
        setNewRuleType(available[0].type);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('alerts.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [homeId]);

  const saveThresholdConfiguration = async () => {
    if (!homeId) return;
    const daily = dailyLimit.trim() === '' ? null : Number(dailyLimit);
    const monthly = monthlyLimit.trim() === '' ? null : Number(monthlyLimit);
    if (daily === null && monthly === null) {
      toast.error(t('alerts.enterLimit'));
      return;
    }
    if ([daily, monthly].some((value) => value !== null && (!Number.isFinite(value) || value < 0))) {
      toast.error(t('alerts.invalidLimits'));
      return;
    }

    setSavingThresholds(true);
    try {
      await alertsApi.saveThresholds(homeId, {
        dailyLimit: daily ?? undefined,
        monthlyLimit: monthly ?? undefined,
        active: thresholdsActive,
      });
      toast.success(t('alerts.thresholdsSaved'));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('alerts.saveThresholdsError'));
    } finally {
      setSavingThresholds(false);
    }
  };

  const createRule = async () => {
    if (!homeId) return;
    const option = customAlertOptions.find(({ type }) => type === newRuleType);
    const threshold = Number(newRuleThreshold);
    if (!option || !Number.isFinite(threshold) || threshold < 0 || (option.unit === 'minutes' && threshold === 0)) {
      toast.error(t('alerts.invalidRule'));
      return;
    }

    setSavingRule(true);
    try {
      await alertsApi.createRule(homeId, {
        alertType: option.type,
        threshold,
        unit: option.unit,
        active: true,
      });
      setNewRuleThreshold('');
      toast.success(t('alerts.ruleCreated'));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('alerts.createRuleError'));
    } finally {
      setSavingRule(false);
    }
  };

  const mark = async (alertId: string, status: 'Read' | 'Dismissed') => {
    try {
      await alertsApi.updateStatus(alertId, status);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('alerts.alertUpdateError'));
    }
  };

  const updateRule = async (rule: AlertRule, changes: { threshold?: number; active?: boolean }) => {
    setBusyRuleId(rule.ruleId);
    try {
      await alertsApi.updateRule(rule.ruleId, changes);
      toast.success(t('alerts.ruleUpdated'));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('alerts.updateRuleError'));
    } finally {
      setBusyRuleId(null);
    }
  };

  const deleteRule = async (rule: AlertRule) => {
    if (!window.confirm(t('alerts.confirmDeleteRule'))) return;
    setBusyRuleId(rule.ruleId);
    try {
      await alertsApi.deleteRule(rule.ruleId);
      toast.success(t('alerts.ruleDeleted'));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('alerts.deleteRuleError'));
    } finally {
      setBusyRuleId(null);
    }
  };

  const displayedRules = rules.filter((rule) => customRuleTypes.has(rule.alertType as CustomAlertType));
  const availableRuleOptions = customAlertOptions.filter(
    ({ type }) => !rules.some((rule) => rule.alertType === type && rule.active)
  );
  const selectedRuleOption = customAlertOptions.find(({ type }) => type === newRuleType);

  if (!homeId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('alerts.title')}</CardTitle>
          <CardDescription>{t('alerts.selectHomeDescription')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <Bell className="mr-2 inline size-5" />
            {t('alerts.title')}
          </CardTitle>
          <CardDescription>{t('alerts.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-600">{t('alerts.pending')}</p>
              <p className="text-2xl">{pendingCount ?? alerts.filter((alert) => alert.status === 'Pending').length}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-600">{t('alerts.dailyLimit')}</p>
              <p className="text-2xl">
                {savedThresholds?.dailyLimit == null ? '—' : `${savedThresholds.dailyLimit} m³`}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-600">{t('alerts.monthlyLimit')}</p>
              <p className="text-2xl">
                {savedThresholds?.monthlyLimit == null ? '—' : `${savedThresholds.monthlyLimit} m³`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('alerts.consumptionThresholds')}</CardTitle>
          <CardDescription>{t('alerts.thresholdDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="daily-alert-limit">{t('alerts.dailyLimitLabel')}</Label>
              <Input
                id="daily-alert-limit"
                type="number"
                min="0"
                step="0.01"
                value={dailyLimit}
                onChange={(event) => setDailyLimit(event.target.value)}
                disabled={!canManage || loading}
                placeholder={t('alerts.noLimit')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly-alert-limit">{t('alerts.monthlyLimitLabel')}</Label>
              <Input
                id="monthly-alert-limit"
                type="number"
                min="0"
                step="0.01"
                value={monthlyLimit}
                onChange={(event) => setMonthlyLimit(event.target.value)}
                disabled={!canManage || loading}
                placeholder={t('alerts.noLimit')}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={thresholdsActive}
              onChange={(event) => setThresholdsActive(event.target.checked)}
              disabled={!canManage || loading}
              className="size-4 accent-blue-600"
            />
            {t('alerts.activateThresholds')}
          </label>
          {!canManage && <p className="text-sm text-gray-500">{t('alerts.ownerOnlyConfig')}</p>}
          {canManage && (
            <Button onClick={() => void saveThresholdConfiguration()} disabled={savingThresholds || loading}>
              <Save className="mr-2 size-4" />
              {savingThresholds ? t('common.saving') : t('alerts.saveLimits')}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('alerts.rules')}</CardTitle>
          <CardDescription>{t('alerts.rulesDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {canManage && availableRuleOptions.length > 0 && (
            <div className="grid gap-3 rounded-lg border bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="new-alert-type">{t('alerts.alertType')}</Label>
                <select
                  id="new-alert-type"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={newRuleType}
                  onChange={(event) => setNewRuleType(event.target.value as CustomAlertType)}
                >
                  {availableRuleOptions.map((option) => (
                    <option key={option.type} value={option.type}>{t(`alerts.types.${option.labelKey}`)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-alert-threshold">{t('alerts.threshold', { unit: selectedRuleOption ? t(`alerts.units.${selectedRuleOption.unitLabelKey}`) : '' })}</Label>
                <Input
                  id="new-alert-threshold"
                  type="number"
                  min={selectedRuleOption?.unit === 'minutes' ? '1' : '0'}
                  step={selectedRuleOption?.unit === 'minutes' ? '1' : '0.01'}
                  value={newRuleThreshold}
                  onChange={(event) => setNewRuleThreshold(event.target.value)}
                  placeholder={t('alerts.enterThreshold')}
                />
              </div>
              <Button onClick={() => void createRule()} disabled={savingRule || loading}>
                <Plus className="mr-2 size-4" />
                {savingRule ? t('common.creating') : t('alerts.createRule')}
              </Button>
            </div>
          )}
          {canManage && availableRuleOptions.length === 0 && (
            <p className="text-sm text-gray-500">{t('alerts.allRulesActive')}</p>
          )}
          {!canManage && <p className="text-sm text-gray-500">{t('alerts.ownerOnlyRules')}</p>}
          {displayedRules.length ? (
            <div className="space-y-3">
              {displayedRules.map((rule) => {
                const option = customAlertOptions.find(({ type }) => type === rule.alertType);
                const busy = busyRuleId === rule.ruleId;
                return (
                  <div key={rule.ruleId} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                    <div>
                      <p className="font-medium">{option ? t(`alerts.types.${option.labelKey}`) : rule.alertType}</p>
                      <Badge variant={rule.active ? 'default' : 'outline'}>{rule.active ? t('alerts.active') : t('alerts.paused')}</Badge>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`alert-rule-${rule.ruleId}`}>{t('alerts.threshold', { unit: option ? t(`alerts.units.${option.unitLabelKey}`) : rule.unit })}</Label>
                      <Input
                        id={`alert-rule-${rule.ruleId}`}
                        type="number"
                        min={rule.unit === 'minutes' ? '1' : '0'}
                        step={rule.unit === 'minutes' ? '1' : '0.01'}
                        value={ruleDrafts[rule.ruleId] ?? String(rule.threshold)}
                        onChange={(event) => setRuleDrafts((current) => ({ ...current, [rule.ruleId]: event.target.value }))}
                        disabled={!canManage || busy}
                      />
                    </div>
                    {canManage && (
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <Button
                          variant="outline"
                          disabled={busy || loading}
                          onClick={() => {
                            const threshold = Number(ruleDrafts[rule.ruleId]);
                            if (!Number.isFinite(threshold) || threshold < 0 || (rule.unit === 'minutes' && threshold === 0)) {
                              toast.error(t('alerts.invalidThreshold'));
                              return;
                            }
                            void updateRule(rule, { threshold });
                          }}
                        >
                          {t('common.save')}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy || loading}
                          onClick={() => void updateRule(rule, { active: !rule.active })}
                        >
                          {rule.active ? t('alerts.pause') : t('alerts.activate')}
                        </Button>
                        <Button
                          variant="outline"
                          aria-label={t('alerts.deleteRule')}
                          disabled={busy || loading}
                          onClick={() => void deleteRule(rule)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('alerts.noRules')}</p>
          )}
        </CardContent>
      </Card>

      {budgetStatus && (
        <Card>
          <CardHeader>
            <CardTitle>{t('alerts.paceAndBudget')}</CardTitle>
            <CardDescription>{t('alerts.paceDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-600">{t('alerts.consumption')}</p>
              <p className="text-xl">{budgetStatus.currentLiters.toFixed(0)} L / {budgetStatus.expectedToDateLiters.toFixed(0)} L {t('alerts.expected')}</p>
              <Badge>{budgetStatus.consumptionStatus || t('alerts.noData')}</Badge>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-600">{t('alerts.budget')}</p>
              <p className="text-xl">
                {budgetStatus.monthlyBudget == null
                  ? t('alerts.noBudget')
                  : `${budgetStatus.currentCost.toLocaleString(localeForLanguage(i18n.language))} / ${budgetStatus.expectedBudgetToDate?.toLocaleString(localeForLanguage(i18n.language)) || '0'}`}
              </p>
              <Badge>{budgetStatus.budgetStatus || t('alerts.noData')}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('alerts.history')}</CardTitle>
          <CardDescription>{t('alerts.historyDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.length ? (
            alerts.map((alert) => (
              <div key={alert.alertId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-1 size-5 text-orange-600" />
                  <div>
                    <p className="font-medium">{alert.message || t('alerts.noDescription')}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(alert.generatedAt).toLocaleString()} · {t('alerts.value')}: {alert.detectedValue ?? '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{alert.status}</Badge>
                  {alert.status === 'Pending' && canManage && (
                    <>
                      <Button size="sm" onClick={() => void mark(alert.alertId, 'Read')}>
                        <CheckCircle2 className="mr-1 size-4" />{t('alerts.read')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void mark(alert.alertId, 'Dismissed')}>
                        {t('alerts.dismiss')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">{loading ? t('alerts.loading') : t('alerts.empty')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
