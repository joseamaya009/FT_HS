import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { devicesApi, homesApi } from '@shared/http/httpClient';
import { Battery, Droplets, Settings, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function TechnicianPanel() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [factor, setFactor] = useState('');
  const [offset, setOffset] = useState('');

  useEffect(() => {
    homesApi
      .list()
      .then(async ({ data }) => {
        const responses = await Promise.all(
          (data as any[]).map((home) => devicesApi.list(home.homeId))
        );
        setDevices(responses.flatMap((response) => response.data as any[]));
      })
      .catch((error) =>
        toast.error(
          error instanceof Error ? error.message : t('technician.devicesLoadError')
        )
      );
  }, []);

  const saveCalibration = async () => {
    if (!selectedDeviceId || !factor || !offset) {
      toast.error(t('technician.calibrationRequired'));
      return;
    }
    try {
      await devicesApi.updateConfig(selectedDeviceId, {
        calibrationFactor: Number(factor),
        calibrationOffset: Number(offset),
        reason: t('technician.calibrationReason'),
      });
      toast.success(t('technician.calibrationSaved'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('technician.calibrationError'));
    }
  };

  const online = devices.filter((device) =>
    ['active', 'online'].includes(String(device.status).toLowerCase())
  ).length;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl">{t('technician.title')}</h2>
        <p className="text-gray-600">{t('technician.description')}</p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>{t('technician.total')}</CardDescription>
            <CardTitle>
              <Droplets className="mr-2 inline size-5" />
              {devices.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t('technician.online')}</CardDescription>
            <CardTitle>
              <Wifi className="mr-2 inline size-5 text-green-600" />
              {online}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t('technician.offline')}</CardDescription>
            <CardTitle>
              <WifiOff className="mr-2 inline size-5 text-red-600" />
              {Math.max(devices.length - online, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('technician.devices')}</CardTitle>
          <CardDescription>{t('technician.backendDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {devices.length ? (
            devices.map((device) => (
              <div
                key={device.deviceId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{device.name}</p>
                  <p className="text-sm text-gray-600">
                    {device.code} · {device.type}
                  </p>
                </div>
                <Badge
                  variant={
                    ['active', 'online'].includes(String(device.status).toLowerCase())
                      ? 'default'
                      : 'destructive'
                  }
                >
                  {device.status}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">{t('technician.noDevices')}</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <Settings className="mr-2 inline size-5" />
            {t('technician.calibration')}
          </CardTitle>
          <CardDescription>{t('technician.calibrationDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label htmlFor="technician-device">{t('technician.device')}</Label>
            <select
              id="technician-device"
              className="mt-2 h-10 w-full rounded-md border px-3"
              value={selectedDeviceId}
              onChange={(event) => setSelectedDeviceId(event.target.value)}
            >
              <option value="">{t('common.select')}</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="calibration-factor">{t('technician.factor')}</Label>
            <Input
              id="calibration-factor"
              type="number"
              value={factor}
              onChange={(event) => setFactor(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="calibration-offset">{t('technician.offset')}</Label>
            <Input
              id="calibration-offset"
              type="number"
              value={offset}
              onChange={(event) => setOffset(event.target.value)}
            />
          </div>
          <Button className="sm:col-span-4" onClick={saveCalibration}>
            <Battery className="mr-2 size-4" />
            {t('technician.saveCalibration')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
