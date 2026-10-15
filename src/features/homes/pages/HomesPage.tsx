import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@shared/ui/dialog';
import { Badge } from '@shared/ui/badge';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  UserPlus,
} from 'lucide-react';
import { homesApi } from '@shared/http/httpClient';
import { toast } from 'sonner';
import { MembershipRequestsPanel } from '../ui/MembershipRequestsPanel';
import { can } from '@shared/config/authorization';

type Home = {
  homeId: string;
  name: string;
  address: string;
  city: string;
  usageType?: 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL';
  tier?: number | null;
  altitudeMeters?: number | null;
  peopleCount?: number;
  status?: string;
};
type Member = {
  userId: string;
  fullName?: string;
  username?: string;
  homeRole?: string;
};

type HomeForm = {
  name: string;
  address: string;
  city: string;
  usageType: 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL';
  tier: string;
  peopleCount: string;
};

const emptyHomeForm: HomeForm = {
  name: '',
  address: '',
  city: '',
  usageType: 'RESIDENTIAL',
  tier: '',
  peopleCount: '3',
};

export function HomeManagement({ permissions = [] }: { permissions?: string[] }) {
  const { t } = useTranslation();
  const canManage = can(permissions, 'homes.manage');
  const [homes, setHomes] = useState<Home[]>([]);
  const [selectedHome, setSelectedHome] = useState<Home | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [newHomeOpen, setNewHomeOpen] = useState(false);
  const [newHomeUsageType, setNewHomeUsageType] = useState<
    'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL'
  >('RESIDENTIAL');
  const [newHomePeopleCount, setNewHomePeopleCount] = useState('3');
  const [editingHome, setEditingHome] = useState<Home | null>(null);
  const [editHomeForm, setEditHomeForm] = useState<HomeForm>(emptyHomeForm);
  const [memberOpen, setMemberOpen] = useState(false);
  const homesCarouselRef = useRef<HTMLDivElement>(null);

  const scrollHomes = (direction: 'previous' | 'next') => {
    homesCarouselRef.current?.scrollBy({
      left: (direction === 'next' ? 1 : -1) * homesCarouselRef.current.clientWidth * 0.85,
      behavior: 'smooth',
    });
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await homesApi.list();
      const loaded = data as Home[];
      setHomes(loaded);
      setSelectedHome(
        (current) => loaded.find((home) => home.homeId === current?.homeId) || loaded[0] || null
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t('homes.loadError');
      setLoadError(message);
      setHomes([]);
      setSelectedHome(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const loadMembers = async (homeId: string) => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const { data } = await homesApi.members(homeId);
      setMembers(data as Member[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('homes.membersLoadError');
      setMembersError(message);
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (selectedHome) {
      void loadMembers(selectedHome.homeId);
    } else {
      setMembers([]);
      setMembersError(null);
    }
  }, [selectedHome]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const peopleCountValue = String(form.get('peopleCount') || '').trim();
    const peopleCount = Number(peopleCountValue);
    if (!/^\d+$/.test(peopleCountValue) || !Number.isInteger(peopleCount)) {
      toast.error(t('homes.peopleCountInvalid'));
      return;
    }
    if (peopleCount < 1 || peopleCount > 50) {
      toast.error(t('homes.peopleCountRange'));
      return;
    }
    try {
      await homesApi.create({
        name: String(form.get('name')),
        address: String(form.get('address')),
        city: String(form.get('city')),
        usageType: String(form.get('usageType')) as 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL',
        tier: String(form.get('tier') || '') || null,
        peopleCount,
      });
      toast.success(t('homes.created'));
      setNewHomeOpen(false);
      setNewHomeUsageType('RESIDENTIAL');
      setNewHomePeopleCount('3');
      event.currentTarget.reset();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('homes.createError'));
    }
  };

  const addMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedHome) return;
    const form = new FormData(event.currentTarget);
    try {
      const result = await homesApi.addMember(selectedHome.homeId, {
        email: String(form.get('email')),
        homeRole: String(form.get('role')) as 'Owner' | 'Member' | 'Guest',
      });
      if (result.notification?.sent) {
        toast.success(t('homes.memberAddedEmailSent'));
      } else if (result.notification) {
        toast.warning(t('homes.memberAddedEmailPending'));
      } else {
        toast.success(t('homes.memberAdded'));
      }
      setMemberOpen(false);
      event.currentTarget.reset();
      await loadMembers(selectedHome.homeId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('homes.addMemberError'));
    }
  };

  const openEditHome = (home: Home) => {
    setEditingHome(home);
    setEditHomeForm({
      name: home.name,
      address: home.address,
      city: home.city,
      usageType: home.usageType || 'RESIDENTIAL',
      tier: home.tier == null ? '' : String(home.tier),
      peopleCount: String(home.peopleCount ?? 3),
    });
  };

  const closeEditHome = () => {
    setEditingHome(null);
    setEditHomeForm(emptyHomeForm);
  };

  const updateHome = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingHome) return;

    const peopleCountValue = editHomeForm.peopleCount.trim();
    const peopleCount = Number(peopleCountValue);
    if (!/^\d+$/.test(peopleCountValue) || !Number.isInteger(peopleCount)) {
      toast.error(t('homes.peopleCountInvalid'));
      return;
    }
    if (peopleCount < 1 || peopleCount > 50) {
      toast.error(t('homes.peopleCountRange'));
      return;
    }
    if (editHomeForm.usageType === 'RESIDENTIAL' && !editHomeForm.tier) {
      toast.error(t('homes.selectStratum'));
      return;
    }

    try {
      await homesApi.update(editingHome.homeId, {
        name: editHomeForm.name.trim(),
        address: editHomeForm.address.trim(),
        city: editHomeForm.city.trim(),
        usageType: editHomeForm.usageType,
        tier: editHomeForm.usageType === 'RESIDENTIAL' ? editHomeForm.tier : null,
        altitudeMeters:
          editingHome.altitudeMeters == null ? null : String(editingHome.altitudeMeters),
        peopleCount,
      });
      toast.success(t('homes.updated'));
      closeEditHome();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('homes.updateError'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl">{t('homes.title')}</h2>
          <p className="text-gray-600">{t('homes.subtitle')}</p>
        </div>
        {canManage && (
          <Dialog
            open={newHomeOpen}
            onOpenChange={(open) => {
              setNewHomeOpen(open);
              if (!open) setNewHomeUsageType('RESIDENTIAL');
              if (!open) setNewHomePeopleCount('3');
            }}
          >
            <DialogTrigger asChild>
              <Button disabled={loading}>
                <Plus className="mr-2 size-4" />
                {t('homes.registerNewHome')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader>
                  <DialogTitle>{t('homes.createTitle')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="home-name">{t('homes.homeName')}</Label>
                    <Input
                      id="home-name"
                      name="name"
                      placeholder={t('homes.homeNamePlaceholder')}
                      maxLength={100}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="home-address">{t('homes.address')}</Label>
                    <Input
                      id="home-address"
                      name="address"
                      placeholder={t('homes.addressPlaceholder')}
                      maxLength={255}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="home-city">{t('homes.city')}</Label>
                    <Input
                      id="home-city"
                      name="city"
                      placeholder={t('homes.cityPlaceholder')}
                      maxLength={100}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="home-usage-type">{t('homes.usageTypeLabel')}</Label>
                    <select
                      id="home-usage-type"
                      name="usageType"
                      className="h-10 w-full rounded-md border px-3"
                      value={newHomeUsageType}
                      onChange={(event) =>
                        setNewHomeUsageType(
                          event.target.value as 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL'
                        )
                      }
                    >
                      <option value="RESIDENTIAL">{t('homes.usageTypeResidential')}</option>
                      <option value="COMMERCIAL">{t('homes.usageTypeCommercial')}</option>
                      <option value="INDUSTRIAL">{t('homes.usageTypeIndustrial')}</option>
                    </select>
                  </div>
                  {newHomeUsageType === 'RESIDENTIAL' && (
                    <div className="space-y-2">
                      <Label htmlFor="home-tier">{t('homes.selectStratum')}</Label>
                      <select
                        id="home-tier"
                        name="tier"
                        className="h-10 w-full rounded-md border px-3"
                        required
                        defaultValue=""
                      >
                        <option value="">{t('homes.selectStratum')}</option>
                        {[1, 2, 3, 4, 5, 6].map((tier) => (
                          <option key={tier} value={tier}>
                            {tier}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="home-people-count">{t('homes.peopleCount')}</Label>
                    <Input
                      id="home-people-count"
                      name="peopleCount"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]+"
                      minLength={1}
                      maxLength={2}
                      value={newHomePeopleCount}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (/^\d*$/.test(value)) setNewHomePeopleCount(value);
                      }}
                      placeholder={t('homes.peopleCountPlaceholder')}
                      aria-label={t('homes.peopleCount')}
                      required
                    />
                    <p className="text-xs text-gray-500">{t('homes.peopleCountRange')}</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{t('common.save')}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {canManage && (
        <Dialog
          open={Boolean(editingHome)}
          onOpenChange={(open) => {
            if (!open) closeEditHome();
          }}
        >
          <DialogContent>
            <form onSubmit={updateHome}>
              <DialogHeader>
                <DialogTitle>{t('homes.configureHome')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-home-name">{t('homes.homeName')}</Label>
                  <Input
                    id="edit-home-name"
                    value={editHomeForm.name}
                    onChange={(event) =>
                      setEditHomeForm((current) => ({ ...current, name: event.target.value }))
                    }
                    maxLength={100}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-home-address">{t('homes.address')}</Label>
                  <Input
                    id="edit-home-address"
                    value={editHomeForm.address}
                    onChange={(event) =>
                      setEditHomeForm((current) => ({ ...current, address: event.target.value }))
                    }
                    maxLength={255}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-home-city">{t('homes.city')}</Label>
                  <Input
                    id="edit-home-city"
                    value={editHomeForm.city}
                    onChange={(event) =>
                      setEditHomeForm((current) => ({ ...current, city: event.target.value }))
                    }
                    maxLength={100}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-home-usage-type">{t('homes.usageTypeLabel')}</Label>
                  <select
                    id="edit-home-usage-type"
                    className="h-10 w-full rounded-md border px-3"
                    value={editHomeForm.usageType}
                    onChange={(event) => {
                      const usageType = event.target.value as HomeForm['usageType'];
                      setEditHomeForm((current) => ({
                        ...current,
                        usageType,
                        tier: usageType === 'RESIDENTIAL' ? current.tier : '',
                      }));
                    }}
                  >
                    <option value="RESIDENTIAL">{t('homes.usageTypeResidential')}</option>
                    <option value="COMMERCIAL">{t('homes.usageTypeCommercial')}</option>
                    <option value="INDUSTRIAL">{t('homes.usageTypeIndustrial')}</option>
                  </select>
                </div>
                {editHomeForm.usageType === 'RESIDENTIAL' && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-home-tier">{t('homes.selectStratum')}</Label>
                    <select
                      id="edit-home-tier"
                      className="h-10 w-full rounded-md border px-3"
                      value={editHomeForm.tier}
                      onChange={(event) =>
                        setEditHomeForm((current) => ({ ...current, tier: event.target.value }))
                      }
                      required
                    >
                      <option value="">{t('homes.selectStratum')}</option>
                      {[1, 2, 3, 4, 5, 6].map((tier) => (
                        <option key={tier} value={tier}>
                          {tier}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="edit-home-people-count">{t('homes.peopleCount')}</Label>
                  <Input
                    id="edit-home-people-count"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]+"
                    minLength={1}
                    maxLength={2}
                    value={editHomeForm.peopleCount}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (/^\d*$/.test(value)) {
                        setEditHomeForm((current) => ({ ...current, peopleCount: value }));
                      }
                    }}
                    required
                  />
                  <p className="text-xs text-gray-500">{t('homes.peopleCountRange')}</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeEditHome}>
                  {t('homes.cancel')}
                </Button>
                <Button type="submit">{t('common.save')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center rounded-lg border bg-white text-sm text-gray-600">
          <Loader2 className="mr-2 size-5 animate-spin" />
          {t('common.loading')}
        </div>
      ) : loadError ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{loadError}</p>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 size-4" />
            {t('common.retry')}
          </Button>
        </div>
      ) : homes.length ? (
        <div className="space-y-2">
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => scrollHomes('previous')}
              disabled={homes.length < 2}
              aria-label={t('homes.previousHome')}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => scrollHomes('next')}
              disabled={homes.length < 2}
              aria-label={t('homes.nextHome')}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div
            ref={homesCarouselRef}
            className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-3 [scrollbar-width:thin]"
            aria-label={t('homes.title')}
          >
            {homes.map((home) => (
              <Card
                key={home.homeId}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedHome(home)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') setSelectedHome(home);
                }}
                className={`w-[calc(100%-0.5rem)] shrink-0 snap-start sm:w-[calc(50%-0.75rem)] ${
                  selectedHome?.homeId === home.homeId ? 'border-blue-600' : ''
                }`}
              >
                <CardHeader>
                  <CardTitle>
                    <Building2 className="mr-2 inline size-5 text-blue-600" />
                    {home.name}
                  </CardTitle>
                  <CardDescription>
                    {home.address} · {home.city}
                  </CardDescription>
                  <CardDescription>
                    {t('homes.peopleCount')}: {home.peopleCount ?? 3}
                  </CardDescription>
                  <CardDescription>
                    {home.usageType === 'COMMERCIAL'
                      ? t('homes.usageTypeCommercial')
                      : home.usageType === 'INDUSTRIAL'
                        ? t('homes.usageTypeIndustrial')
                        : `${t('homes.usageTypeResidential')} · ${t('homes.stratum')} ${home.tier ?? '—'}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-2">
                  <Badge>{home.status || t('homes.active')}</Badge>
                  <div className="flex flex-wrap gap-2">
                    {canManage && (
                      <Button variant="outline" size="sm" onClick={() => openEditHome(home)}>
                        <Settings2 className="mr-2 size-4" />
                        {t('homes.edit')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-gray-600">{t('homes.noHomes')}</p>
          <p className="mt-2 text-sm text-gray-500">{t('homes.createFirst')}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{t('homes.homeMembers')}</CardTitle>
              <CardDescription>
                {selectedHome?.name || t('homes.selectHomeForMembers')}
              </CardDescription>
            </div>
            {selectedHome && canManage && (
              <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
                <DialogTrigger asChild>
                  <Button disabled={membersLoading}>
                    <UserPlus className="mr-2 size-4" />
                    {t('homes.addMember')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={addMember}>
                    <DialogHeader>
                      <DialogTitle>{t('homes.addMemberTitle')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <Input
                        name="email"
                        type="email"
                        placeholder={t('homes.memberEmailPlaceholder')}
                        required
                      />
                      <select
                        name="role"
                        className="h-10 w-full rounded-md border px-3"
                        defaultValue="Member"
                      >
                        <option value="Member">{t('homes.member')}</option>
                        <option value="Guest">{t('roles.guest')}</option>
                      </select>
                    </div>
                    <DialogFooter>
                      <Button type="submit">{t('homes.addMemberButton')}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {membersLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-600">
              <Loader2 className="mr-2 size-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : membersError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
              <p className="text-sm text-red-700">{membersError}</p>
              {selectedHome && (
                <Button variant="outline" onClick={() => void loadMembers(selectedHome.homeId)}>
                  <RefreshCw className="mr-2 size-4" />
                  {t('common.retry')}
                </Button>
              )}
            </div>
          ) : members.length ? (
            <div className="space-y-2">
              {members.map((member) => {
                const role = String(member.homeRole || 'Member');
                const roleLabel =
                  role === 'Owner'
                    ? t('roles.owner')
                    : role === 'Guest'
                      ? t('roles.guest')
                      : t('homes.member');
                return (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {member.fullName || member.username || t('homes.memberWithoutName')}
                      </p>
                    </div>
                    <Badge variant={role === 'Owner' ? 'default' : 'outline'}>{roleLabel}</Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {selectedHome ? t('homes.noMembersInHome') : t('homes.selectHomeForMembers')}
            </p>
          )}
        </CardContent>
      </Card>
      {canManage && <MembershipRequestsPanel />}
    </div>
  );
}
