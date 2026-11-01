import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Label } from '@shared/ui/label';
import { Badge } from '@shared/ui/badge';
import { Plane } from 'lucide-react';
import { vacationApi } from '@shared/http/httpClient';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

type Vacation = { active?: boolean; isActive?: boolean; startedAt?: string; endedAt?: string };

export function VacationMode({ homeId }: { homeId?: string }) {
  const { t } = useTranslation();
  const [vacation, setVacation] = useState<Vacation | null>(null);
  const [startedAt, setStartedAt] = useState('');
  const [endedAt, setEndedAt] = useState('');

  const load = (id: string) =>
    vacationApi
      .get(id)
      .then(({ data }) => {
        const current = data as Vacation | null;
        setVacation(current);
        setStartedAt(current?.startedAt?.slice(0, 10) || '');
        setEndedAt(current?.endedAt?.slice(0, 10) || '');
      })
      .catch(() => setVacation(null));
  useEffect(() => {
    if (homeId) load(homeId);
    else setVacation(null);
  }, [homeId]);

  const save = async () => {
    if (!homeId || !startedAt || !endedAt || startedAt >= endedAt) {
      toast.error(t('vacation.invalidRange'));
      return;
    }
    try {
      const response = await vacationApi.save(homeId, {
        active: true,
        startedAt,
        endedAt,
        notifyOnReturn: true,
      });
      setVacation(response.data as Vacation);
      toast.success(t('vacation.activated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('vacation.enableError'));
    }
  };
  const disable = async () => {
    try {
      if (!homeId) return;
      await vacationApi.remove(homeId);
      setVacation(null);
      setStartedAt('');
      setEndedAt('');
      toast.success(t('vacation.deactivated'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('vacation.disableError')
      );
    }
  };
  const active = Boolean(vacation?.isActive ?? vacation?.active);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Plane className="size-6 text-blue-600" />
            <div>
              <CardTitle>{t('vacation.title')}</CardTitle>
              <CardDescription>
                {t('vacation.description')}
              </CardDescription>
            </div>
            <Badge className="ml-auto">{active ? t('vacation.active') : t('vacation.inactive')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="vacation-start">{t('vacation.startDate')}</Label>
              <input
                id="vacation-start"
                type="date"
                className="mt-2 h-10 w-full rounded-md border px-3"
                value={startedAt}
                onChange={(event) => setStartedAt(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="vacation-end">{t('vacation.endDate')}</Label>
              <input
                id="vacation-end"
                type="date"
                className="mt-2 h-10 w-full rounded-md border px-3"
                value={endedAt}
                onChange={(event) => setEndedAt(event.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={save} disabled={active}>
              {t('vacation.enable')}
            </Button>
            <Button variant="outline" onClick={disable} disabled={!active}>
              {t('vacation.disable')}
            </Button>
          </div>
        </CardContent>
      </Card>
      <p className="text-sm text-gray-500">
        {t('vacation.backendNotice')}
      </p>
    </div>
  );
}
