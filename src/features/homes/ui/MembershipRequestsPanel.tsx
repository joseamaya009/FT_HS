import { useEffect, useState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { homesApi, MembershipRequest } from '@shared/http/apiClient';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Label } from '@shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { useTranslation } from 'react-i18next';
import { localeForLanguage } from '@shared/i18n/locale';

type HomeOption = { homeId: string; name: string; status?: string };

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(localeForLanguage(language), { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value)
  );
}

/** Flujo real de solicitudes de ingreso; no usa usuarios ni hogares quemados. */
export function MembershipRequestsPanel() {
  const { t, i18n } = useTranslation();
  const [homes, setHomes] = useState<HomeOption[]>([]);
  const [selectedHomeId, setSelectedHomeId] = useState('');
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadRequests = async (homeId: string) => {
    if (!homeId) return;
    try {
      const response = await homesApi.membershipRequests(homeId);
      setRequests(response.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('membership.loadRequestsError'));
    }
  };

  useEffect(() => {
    homesApi
      .list()
      .then((response) => {
        const available = (response.data as Array<Record<string, unknown>>).map((home) => ({
          homeId: String(home.homeId),
          name: String(home.name ?? t('homes.home')),
          status: String(home.status ?? ''),
        }));
        setHomes(available);
        if (available[0]) setSelectedHomeId(available[0].homeId);
      })
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : t('membership.loadHomesError'))
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedHomeId) loadRequests(selectedHomeId);
  }, [selectedHomeId]);

  const requestAccess = async () => {
    if (!selectedHomeId) return;
    setBusyId('new');
    try {
      await homesApi.requestMembership(selectedHomeId);
      await loadRequests(selectedHomeId);
      toast.success(t('membership.requestSent'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('membership.requestSendError'));
    } finally {
      setBusyId(null);
    }
  };

  const answerRequest = async (requestId: string, status: 'Approved' | 'Rejected') => {
    setBusyId(requestId);
    try {
      await homesApi.answerMembershipRequest(requestId, status);
      await loadRequests(selectedHomeId);
      toast.success(status === 'Approved' ? t('membership.requestApproved') : t('membership.requestRejected'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('membership.requestAnswerError'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return null;
  if (!homes.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('membership.title')}</CardTitle>
        <CardDescription>
          {t('membership.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="membership-home">{t('homes.home')}</Label>
            <Select value={selectedHomeId} onValueChange={setSelectedHomeId}>
              <SelectTrigger id="membership-home">
                <SelectValue placeholder={t('membership.selectHome')} />
              </SelectTrigger>
              <SelectContent>
                {homes.map((home) => (
                  <SelectItem key={home.homeId} value={home.homeId}>
                    {home.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={requestAccess}
            disabled={busyId !== null}
          >
            <UserPlus className="mr-2 size-4" /> {t('membership.requestAccess')}
          </Button>
        </div>

        {!requests.length ? (
          <Alert>
            <AlertDescription>{t('membership.empty')}</AlertDescription>
          </Alert>
        ) : (
          requests.map((request) => (
            <div
              key={request.requestId}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">
                  {request.fullName || request.email || `Usuario ${request.userId}`}
                </p>
                {request.email && <p className="text-xs text-gray-600">{request.email}</p>}
                <p className="text-xs text-gray-500">
                  {t('membership.requested')}: {formatDate(request.requestedAt, i18n.language)}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Badge
                  className="self-start sm:self-auto"
                  variant={request.status === 'Pending' ? 'secondary' : 'outline'}
                >
                  {request.status}
                </Badge>
                {request.status === 'Pending' && (
                  <div className="flex w-full gap-2 sm:w-auto">
                    <Button
                      type="button"
                      size="sm"
                      className="min-w-0 flex-1 px-2 sm:flex-initial"
                      onClick={() => answerRequest(request.requestId, 'Approved')}
                      disabled={busyId !== null}
                    >
                      <Check className="mr-1 size-4" /> {t('membership.approve')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-w-0 flex-1 px-2 sm:flex-initial"
                      onClick={() => answerRequest(request.requestId, 'Rejected')}
                      disabled={busyId !== null}
                    >
                      <X className="mr-1 size-4" /> {t('membership.reject')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
