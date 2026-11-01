import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Input } from '@shared/ui/input';
import { Button } from '@shared/ui/button';
import { Shield } from 'lucide-react';
import { auditApi } from '@shared/http/httpClient';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

type AuditEvent = {
  auditId: string;
  action: string;
  tableName?: string;
  recordId?: string;
  description?: string;
  sourceIp?: string;
  createdAt: string;
};

export function AuditLog() {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState('');
  const load = () =>
    auditApi
      .logs('pageSize=100')
      .then(({ data }) => setEvents(data as AuditEvent[]))
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : t('audit.loadError'))
      );
  useEffect(() => {
    void load();
  }, []);
  const filtered = events.filter((event) =>
    `${event.action} ${event.tableName || ''} ${event.description || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="size-6 text-purple-600" />
            <div>
              <CardTitle>{t('audit.title')}</CardTitle>
              <CardDescription>{t('audit.description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder={t('audit.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">{t('audit.date')}</th>
                  <th className="p-3">{t('audit.action')}</th>
                  <th className="p-3">{t('audit.table')}</th>
                  <th className="p-3">{t('audit.descriptionColumn')}</th>
                  <th className="p-3">{t('audit.ip')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event) => (
                  <tr key={event.auditId} className="border-b">
                    <td className="p-3">{new Date(event.createdAt).toLocaleString(i18n.language)}</td>
                    <td className="p-3">{event.action}</td>
                    <td className="p-3">{event.tableName || '—'}</td>
                    <td className="p-3">{event.description || '—'}</td>
                    <td className="p-3">{event.sourceIp || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <p className="text-sm text-gray-500">{t('audit.empty')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
