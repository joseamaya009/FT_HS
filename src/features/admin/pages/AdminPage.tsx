import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Droplets,
  Home,
  Loader2,
  MapPin,
  Search,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Input } from '@shared/ui/input';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { userApi } from '@shared/http/apiClient';
import type {
  ManagedDeviceOverview,
  ManagedUser,
  ManagedUserOverview,
} from '@shared/http/apiClient';

function isOnline(device: ManagedDeviceOverview) {
  const connectivity = String(device.connectivityStatus ?? '').toUpperCase();
  const status = String(device.status ?? '').toLowerCase();
  return connectivity === 'ONLINE' || status === 'online' || status === 'active';
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin conexión registrada';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Sin conexión registrada'
    : `Última conexión: ${date.toLocaleString('es-CO')}`;
}

function statusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'active') return 'Activo';
  if (normalized === 'suspended') return 'Suspendido';
  if (normalized === 'blocked') return 'Bloqueado';
  return status || 'Sin estado';
}

export function AdminPanel() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [overview, setOverview] = useState<ManagedUserOverview | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setUsersLoading(true);

    userApi
      .listManagedUsers({
        search: search.trim() || undefined,
        page: 1,
        pageSize: 100,
        sort: 'username',
        order: 'asc',
      })
      .then(({ data }) => {
        if (!active) return;
        setUsers(data);
        setSelectedUserId((current) =>
          current && data.some((user) => user.userId === current)
            ? current
            : (data[0]?.userId ?? null)
        );
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios');
        setUsers([]);
        setSelectedUserId(null);
      })
      .finally(() => {
        if (active) setUsersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [search]);

  useEffect(() => {
    if (!selectedUserId) {
      setOverview(null);
      return undefined;
    }

    let active = true;
    setOverviewLoading(true);
    userApi
      .getManagedUserOverview(selectedUserId)
      .then(({ data }) => {
        if (active) setOverview(data);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(
          error instanceof Error ? error.message : 'No se pudo cargar el detalle del usuario'
        );
        setOverview(null);
      })
      .finally(() => {
        if (active) setOverviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedUserId]);

  const selectedUser = useMemo(
    () => users.find((user) => user.userId === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl">Panel administrativo</h2>
        <p className="text-gray-600">
          Selecciona un usuario para consultar los hogares y dispositivos que tiene asociados.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-blue-600" />
              Usuarios
            </CardTitle>
            <CardDescription>{users.length} usuarios encontrados</CardDescription>
            <div className="relative pt-2">
              <Search className="absolute left-3 top-5 size-4 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, usuario o correo"
                className="pl-9"
                aria-label="Buscar usuarios"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {usersLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                <Loader2 className="size-4 animate-spin" /> Cargando usuarios...
              </div>
            ) : users.length ? (
              users.map((user) => {
                const selected = user.userId === selectedUserId;
                return (
                  <button
                    key={user.userId}
                    type="button"
                    onClick={() => setSelectedUserId(user.userId)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selected ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 font-medium text-blue-700">
                      {(user.fullName || user.username || user.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{user.fullName || user.username}</p>
                      <p className="truncate text-xs text-gray-500">{user.email}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={user.status === 'Active' ? 'secondary' : 'outline'}>
                          {statusLabel(user.status)}
                        </Badge>
                        <span className="truncate text-xs text-gray-500">
                          {user.roles.join(', ')}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-gray-400" />
                  </button>
                );
              })
            ) : (
              <p className="py-8 text-center text-sm text-gray-500">
                No hay usuarios para mostrar.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          {overviewLoading ? (
            <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="size-4 animate-spin" /> Cargando hogares y dispositivos...
            </div>
          ) : overview ? (
            <>
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{overview.fullName || overview.username}</CardTitle>
                    <CardDescription>
                      {overview.email} · usuario {statusLabel(overview.status).toLowerCase()}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <Badge variant="outline">
                      <Home className="mr-1 size-3" /> {overview.homes.length} hogares
                    </Badge>
                    <Badge variant="outline">
                      <Droplets className="mr-1 size-3" /> {overview.devices.length} dispositivos
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <section>
                  <h3 className="mb-3 flex items-center gap-2 font-medium">
                    <Home className="size-4 text-purple-600" /> Hogares asociados
                  </h3>
                  {overview.homes.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {overview.homes.map((home) => (
                        <div key={home.homeId} className="rounded-lg border p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium">{home.name}</p>
                            <Badge variant={home.homeRole === 'Owner' ? 'default' : 'outline'}>
                              {home.homeRole === 'Owner'
                                ? t('roles.owner')
                                : home.homeRole === 'Guest'
                                  ? t('roles.guest')
                                  : t('homes.member')}
                            </Badge>
                          </div>
                          <p className="mt-2 flex items-center gap-1 text-sm text-gray-600">
                            <MapPin className="size-3.5" /> {home.address}, {home.city}
                          </p>
                          <p className="mt-2 text-xs text-gray-500">
                            {home.deviceCount}{' '}
                            {home.deviceCount === 1 ? 'dispositivo' : 'dispositivos'} · estado{' '}
                            {home.status}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-gray-500">
                      Este usuario no tiene hogares asociados.
                    </p>
                  )}
                </section>

                <section>
                  <h3 className="mb-3 flex items-center gap-2 font-medium">
                    <Droplets className="size-4 text-cyan-600" /> Dispositivos asociados
                  </h3>
                  {overview.devices.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {overview.devices.map((device) => {
                        const online = isOnline(device);
                        return (
                          <div key={device.deviceId} className="rounded-lg border p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium">{device.name}</p>
                                <p className="text-sm text-gray-500">
                                  {device.code} · {device.type}
                                </p>
                              </div>
                              <Badge variant={online ? 'secondary' : 'outline'}>
                                {online ? (
                                  <Wifi className="mr-1 size-3" />
                                ) : (
                                  <WifiOff className="mr-1 size-3" />
                                )}
                                {online ? 'En línea' : 'Fuera de línea'}
                              </Badge>
                            </div>
                            <div className="mt-3 space-y-1 text-xs text-gray-600">
                              <p>Hogar: {device.homeName}</p>
                              <p>Ubicación: {device.location || 'No definida'}</p>
                              <p>Hardware: {device.hardwareId || 'Pendiente de vincular'}</p>
                              <p>{formatDate(device.lastConnectionAt)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-gray-500">
                      Este usuario no tiene dispositivos asociados.
                    </p>
                  )}
                </section>
              </CardContent>
            </>
          ) : (
            <div className="flex min-h-80 items-center justify-center p-6 text-center text-sm text-gray-500">
              {selectedUser
                ? 'No se pudo cargar la información del usuario seleccionado.'
                : 'Selecciona un usuario para ver sus hogares y dispositivos.'}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
