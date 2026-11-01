import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Checkbox } from '@shared/ui/checkbox';
import { Label } from '@shared/ui/label';
import { ScrollArea } from '@shared/ui/scroll-area';
import { Shield, Info, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@shared/ui/alert';

interface PrivacyConsentProps {
  onAccept: () => void;
}

// RF7 - Gestión de Privacidad y Consentimiento de Datos
export function PrivacyConsent({ onAccept }: PrivacyConsentProps) {
  const { t } = useTranslation();
  const [acceptLegal, setAcceptLegal] = useState(false);

  const canProceed = acceptLegal;

  const handleAccept = () => {
    if (canProceed) {
      // RF7.4 - Registrar consentimientos otorgados
      onAccept();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-100 p-4">
      <Card className="w-full max-w-3xl shadow-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Shield className="size-6 text-white" />
            </div>
            <CardTitle className="text-2xl">{t('privacy.consentTitle')}</CardTitle>
          </div>
          <CardDescription>
            {t('privacy.consentDescription')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* RF7.3 - Mostrar claramente qué datos se recopilan */}
          <Alert>
            <Info className="size-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">{t('privacy.collectedData')}</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{t('privacy.collectedPersonal')}</li>
                  <li>{t('privacy.collectedConsumption')}</li>
                  <li>{t('privacy.collectedLocation')}</li>
                  <li>{t('privacy.collectedActivity')}</li>
                  <li>{t('privacy.collectedPreferences')}</li>
                </ul>
                <p className="font-semibold mt-3">{t('privacy.collectionPurpose')}</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{t('privacy.purposeMonitoring')}</li>
                  <li>{t('privacy.purposeReports')}</li>
                  <li>{t('privacy.purposeLeaks')}</li>
                  <li>{t('privacy.purposeService')}</li>
                  <li>{t('privacy.purposeSupport')}</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* Política de privacidad completa */}
          <div className="space-y-3">
            <Label>{t('privacy.policyTitle')}</Label>
            <ScrollArea className="h-64 w-full rounded-lg border bg-gray-50 p-4">
              <div className="space-y-4 text-sm text-gray-700">
                <h3 className="font-semibold">{t('privacy.section1Title')}</h3>
                <p>{t('privacy.section1Body')}</p>

                <h3 className="font-semibold">{t('privacy.section2Title')}</h3>
                <p>{t('privacy.section2Body')}</p>

                <h3 className="font-semibold">{t('privacy.section3Title')}</h3>
                <p>{t('privacy.section3Body')}</p>

                <h3 className="font-semibold">{t('privacy.section4Title')}</h3>
                <p>{t('privacy.section4Body')}</p>

                <h3 className="font-semibold">{t('privacy.section5Title')}</h3>
                <p>{t('privacy.section5Body')}</p>

                <h3 className="font-semibold">{t('privacy.section6Title')}</h3>
                <p>{t('privacy.section6Body')}</p>

                <h3 className="font-semibold">{t('privacy.section7Title')}</h3>
                <p>{t('privacy.section7Body')}</p>
              </div>
            </ScrollArea>
          </div>

          {/* RF7.1 - Consentimientos requeridos */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="legalConsent"
                checked={acceptLegal}
                onCheckedChange={(checked) => setAcceptLegal(checked as boolean)}
              />
              <Label htmlFor="legalConsent" className="text-sm leading-relaxed cursor-pointer">
                <span className="text-red-600">*</span> {t('privacy.legalConsent')}
              </Label>
            </div>
          </div>

          {/* RF7.2 - Canal real para solicitudes de privacidad */}
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription className="text-sm">
              {t('privacy.rightsNotice')}
            </AlertDescription>
          </Alert>
        </CardContent>

        <CardFooter>
          <Button onClick={handleAccept} disabled={!canProceed} className="w-full">
            {t('privacy.backToForm')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
