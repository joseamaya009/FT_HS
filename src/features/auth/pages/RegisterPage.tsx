import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { Checkbox } from '@shared/ui/checkbox';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Progress } from '@shared/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import { Eye, EyeOff, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  documentNumberPattern,
  emailPattern,
  isValidPassword,
  normalizeDocumentNumber,
  passwordValidation as getPasswordValidation,
} from '@shared/lib/validators';
import logoImage from '@/imports/aaa-Photoroom-1.png';

interface RegisterScreenProps {
  onRegister: (payload: {
    username: string;
    email: string;
    password: string;
    fullName: string;
    documentType: 'CC' | 'CE';
    documentNumber: string;
    privacyPolicyAccepted: boolean;
    termsAccepted: boolean;
    privacyPolicyVersion: string;
    termsVersion: string;
  }) => Promise<void>;
  initialFormData?: {
    name: string;
    email: string;
    docType: string;
    docNumber: string;
    password: string;
    confirmPassword: string;
  } | null;
  initialLegalAccepted?: boolean;
  onReviewTerms: (draft: {
    name: string;
    email: string;
    docType: string;
    docNumber: string;
    password: string;
    confirmPassword: string;
  }) => void;
}

// RF1 - Registro de Usuario
export function RegisterScreen({
  onRegister,
  initialFormData,
  initialLegalAccepted = false,
  onReviewTerms,
}: RegisterScreenProps) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState(
    initialFormData || {
      name: '',
      email: '',
      docType: '',
      docNumber: '',
      password: '',
      confirmPassword: '',
    }
  );
  const [acceptedLegal, setAcceptedLegal] = useState(initialLegalAccepted);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentError, setDocumentError] = useState('');
  const [legalDocument, setLegalDocument] = useState<'terms' | 'privacy' | null>(null);

  // RF1.2 - Validación de contraseña
  const passwordValidation = getPasswordValidation(formData.password);
  const passwordStrength =
    (passwordValidation.hasMinLength ? 20 : 0) +
    (passwordValidation.hasUpperCase ? 20 : 0) +
    (passwordValidation.hasLowerCase ? 20 : 0) +
    (passwordValidation.hasNumber ? 20 : 0) +
    (passwordValidation.hasSymbol ? 20 : 0);

  // RF1.1, RF1.3 - Validar todos los campos
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar campos obligatorios
    if (
      !formData.name ||
      !formData.email ||
      !formData.docType ||
      !formData.docNumber ||
      !formData.password
    ) {
      toast.error(t('auth.registrationRequiredFields'));
      return;
    }

    if (!documentNumberPattern.test(formData.docNumber)) {
      toast.error(t('auth.documentNumberInvalid'));
      return;
    }

    // RF1.1 - No se admiten menores de edad (simulado con validación de documento)
    if (formData.docType === 'TI') {
      toast.error(t('auth.minorNotAllowed'));
      return;
    }

    // Validar formato de email
    if (!emailPattern.test(formData.email)) {
      toast.error(t('auth.invalidEmail'));
      return;
    }

    // RF1.2 - Validar contraseña
    if (!isValidPassword(formData.password)) {
      toast.error(t('auth.passwordRequirementsInvalid'));
      return;
    }

    // Validar confirmación de contraseña
    if (formData.password !== formData.confirmPassword) {
      toast.error(t('auth.passwordsDoNotMatch'));
      return;
    }

    // RF7.1 - Validar aceptación de políticas
    if (!acceptedLegal) {
      toast.error(t('auth.legalConsentRequired'));
      return;
    }

    try {
      setIsSubmitting(true);
      await onRegister({
        username: formData.email.trim().toLowerCase(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        fullName: formData.name.trim(),
        documentType: formData.docType as 'CC' | 'CE',
        documentNumber: formData.docNumber,
        privacyPolicyAccepted: acceptedLegal,
        termsAccepted: acceptedLegal,
        privacyPolicyVersion: '2026-09',
        termsVersion: '2026-09',
      });
      toast.success(t('auth.registrationPendingNotice'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('auth.registrationError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateDocumentNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    setDocumentError(digits.length > 10 ? 'El número de documento admite máximo 10 dígitos.' : '');
    updateFormData('docNumber', normalizeDocumentNumber(value));
  };

  return (
    <div className="auth-page min-h-dvh flex items-start justify-center bg-gradient-to-br from-blue-50 to-cyan-100 p-3 py-5 sm:items-center sm:p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 items-start md:items-center">
        <div className="text-center md:text-left space-y-2 md:space-y-6">
          <div className="flex min-w-0 items-center justify-center md:justify-start gap-3 sm:gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-blue-600 p-2 sm:size-24 sm:rounded-2xl sm:p-3">
              <img
                src={logoImage}
                alt="HidroSmart Logo"
                className="size-10 object-contain sm:size-20"
              />
            </div>
            <h1 className="min-w-0 break-words text-xl sm:text-5xl text-blue-900 hidrosmart-logo">
              {t('app.name')}
            </h1>
          </div>
          <h2 className="text-sm leading-snug sm:text-2xl text-blue-800">{t('app.tagline')}</h2>
          <p className="hidden text-blue-700 sm:block">{t('login.description')}</p>
          <div className="hidden sm:grid grid-cols-3 gap-4 pt-4">
            <div className="text-center">
              <div className="text-3xl text-blue-600">24/7</div>
              <div className="text-sm text-blue-700">{t('login.monitoring247')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl text-blue-600">IoT</div>
              <div className="text-sm text-blue-700">{t('login.smartDevices')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl text-blue-600">100%</div>
              <div className="text-sm text-blue-700">{t('login.secure')}</div>
            </div>
          </div>
        </div>

        <Card className="register-card w-full max-w-2xl justify-self-center overflow-hidden rounded-2xl border border-white/70 shadow-xl">
          <nav
            className="auth-mode-switch mx-4 mt-4"
            aria-label={`${t('auth.login')} / ${t('auth.register')}`}
          >
            <Link className="auth-mode-switch-item" to="/login">
              {t('auth.login')}
            </Link>
            <span className="auth-mode-switch-item is-active" aria-current="page">
              {t('auth.register')}
            </span>
          </nav>
          <CardHeader className="px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
            <CardTitle>{t('auth.createAccountTitle')}</CardTitle>
            <CardDescription>
              {t('auth.completeRequiredFields')}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 px-5 sm:px-6">
              {/* RF1.1 - Nombre completo */}
              <div className="space-y-2">
                <Label htmlFor="name">{t('settings.fullName')} *</Label>
                <Input
                  id="name"
                  placeholder={t('auth.fullNamePlaceholder')}
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  required
                />
              </div>

              {/* RF1.1 - Tipo y número de documento (C.C/C.E) */}
              <div className="mobile-inline-grid grid grid-cols-2 gap-2 sm:gap-3">
                <div className="space-y-2">
                  <Label htmlFor="docType">{t('settings.documentType')} *</Label>
                  <Select
                    value={formData.docType}
                    onValueChange={(value) => updateFormData('docType', value)}
                  >
                    <SelectTrigger id="docType" type="button" aria-required="true">
                      <SelectValue placeholder={t('common.select')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CC">{t('settings.citizenshipId')}</SelectItem>
                      <SelectItem value="CE">{t('settings.foreignerId')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-600">{t('auth.minorNotice')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="docNumber">{t('settings.documentNumber')} *</Label>
                  <Input
                    id="docNumber"
                    placeholder="1234567890"
                    value={formData.docNumber}
                    onChange={(e) => updateDocumentNumber(e.target.value)}
                    inputMode="numeric"
                    pattern="[0-9]{1,10}"
                    required
                  />
                    <p className={`text-xs ${documentError ? 'text-red-600' : 'text-gray-500'}`}>
                    {documentError || t('auth.documentDigits', { count: formData.docNumber.length })}
                  </p>
                </div>
              </div>

              {/* RF1.1 - Correo electrónico */}
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')} *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  required
                />
              </div>

              {/* RF1.2 - Contraseña con requisitos */}
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')} *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => updateFormData('password', e.target.value)}
                    className="pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t('common.hide') : t('common.show')}
                    className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center border-0 bg-transparent p-0 text-gray-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-0"
                    style={{
                      border: 'none',
                      outline: 'none',
                      boxShadow: 'none',
                      background: 'transparent',
                    }}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>

                {/* RF1.2 - Indicador de fortaleza de contraseña */}
                {formData.password && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Progress value={passwordStrength} className="flex-1" />
                      <span className="text-xs text-gray-600">{passwordStrength}%</span>
                    </div>
                    <div className="text-xs space-y-1">
                      <div
                        className={`flex items-center gap-1 ${passwordValidation.hasMinLength ? 'text-green-600' : 'text-gray-500'}`}
                      >
                        {passwordValidation.hasMinLength ? (
                          <CheckCircle2 className="size-3" />
                        ) : (
                          <X className="size-3" />
                        )}
                        {t('auth.passwordMinCharacters')}
                      </div>
                      <div
                        className={`flex items-center gap-1 ${passwordValidation.hasUpperCase ? 'text-green-600' : 'text-gray-500'}`}
                      >
                        {passwordValidation.hasUpperCase ? (
                          <CheckCircle2 className="size-3" />
                        ) : (
                          <X className="size-3" />
                        )}
                        {t('auth.passwordUppercase')}
                      </div>
                      <div
                        className={`flex items-center gap-1 ${passwordValidation.hasLowerCase ? 'text-green-600' : 'text-gray-500'}`}
                      >
                        {passwordValidation.hasLowerCase ? (
                          <CheckCircle2 className="size-3" />
                        ) : (
                          <X className="size-3" />
                        )}
                        {t('auth.passwordLowercase')}
                      </div>
                      <div
                        className={`flex items-center gap-1 ${passwordValidation.hasNumber ? 'text-green-600' : 'text-gray-500'}`}
                      >
                        {passwordValidation.hasNumber ? (
                          <CheckCircle2 className="size-3" />
                        ) : (
                          <X className="size-3" />
                        )}
                        {t('auth.passwordNumber')}
                      </div>
                      <div
                        className={`flex items-center gap-1 ${passwordValidation.hasSymbol ? 'text-green-600' : 'text-gray-500'}`}
                      >
                        {passwordValidation.hasSymbol ? (
                          <CheckCircle2 className="size-3" />
                        ) : (
                          <X className="size-3" />
                        )}
                        {t('auth.passwordSymbol')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth.confirmPassword')} *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                    className={`pr-12 ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500' : ''}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? t('common.hide') : t('common.show')}
                    className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center border-0 bg-transparent p-0 text-gray-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-0"
                    style={{
                      border: 'none',
                      outline: 'none',
                      boxShadow: 'none',
                      background: 'transparent',
                    }}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-red-600">{t('auth.passwordsDoNotMatch')}</p>
                )}
              </div>

              {/* RF7.1 - Aceptar políticas */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-start space-x-3">
                  <Checkbox id="legalConsent" checked={acceptedLegal} disabled />
                  <Label htmlFor="legalConsent" className="text-sm leading-relaxed">
                    <span className="text-red-600">*</span> Acepto los términos y condiciones y la
                    {t('auth.legalConsentLabel')}
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => onReviewTerms(formData)}
                >
                  {acceptedLegal
                    ? t('auth.readTermsAgain')
                    : t('auth.readTerms')}
                </Button>
              </div>

              {/* RF1.5 - Información sobre verificación */}
              <Alert>
                <AlertCircle className="size-4" />
                <AlertDescription className="text-sm">
                  {t('auth.verificationEmailNotice')}
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="px-5 pb-5 sm:px-6 sm:pb-6">
              <Button
                type="submit"
                className="h-12 w-full rounded-xl text-sm font-semibold shadow-sm"
                disabled={isSubmitting || !acceptedLegal}
              >
                {isSubmitting ? t('auth.creatingAccount') : t('auth.register')}
              </Button>
            </CardFooter>
          </form>
          <Dialog
            open={legalDocument !== null}
            onOpenChange={(open) => {
              if (!open) setLegalDocument(null);
            }}
          >
            <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {legalDocument === 'terms' ? t('auth.termsAndConditions') : t('auth.privacyPolicy')}
                </DialogTitle>
                <DialogDescription>{t('auth.localLegalVersion')}</DialogDescription>
              </DialogHeader>
              {legalDocument === 'terms' ? (
                <div className="space-y-3 text-sm text-gray-700">
                  <p>
                    {t('auth.termsParagraph1')}
                  </p>
                  <p>
                    {t('auth.termsParagraph2')}
                  </p>
                  <p>
                    {t('auth.termsParagraph3')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-gray-700">
                  <p>
                    {t('auth.privacyParagraph1')}
                  </p>
                  <p>
                    {t('auth.privacyParagraph2')}
                  </p>
                  <p>
                    {t('auth.privacyParagraph3')}
                  </p>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </Card>
      </div>
    </div>
  );
}
