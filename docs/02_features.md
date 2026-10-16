# 02_features: módulos funcionales de la interfaz

## Propósito

src/features separa la interfaz por capacidad de negocio. Cada módulo conserva
sus pantallas y, si corresponde, su adaptador HTTP, gráficas o componentes
específicos. Todos consumen apiClient, autenticación y permisos compartidos.

## Archivos por módulo

### admin

- **AuditPage.tsx:** implementa Audit Page para el módulo admin.
- **AdminPage.tsx:** renderiza la pantalla principal del módulo admin.
- **UserManagementPage.tsx:** implementa User Management Page para el módulo admin.

### alerts

- **alerts.api.ts:** centraliza llamadas HTTP del módulo alerts.
- **AlertsPage.tsx:** renderiza la pantalla principal del módulo alerts.

### auth

- **auth.api.ts:** centraliza llamadas HTTP del módulo auth.
- **index.ts:** expone la superficie pública del módulo de autenticación.
- **LoginPage.tsx:** renderiza la pantalla principal del módulo auth.
- **RegisterPage.tsx:** renderiza la pantalla principal del módulo auth.
- **VerifyEmailPage.tsx:** renderiza la pantalla principal del módulo auth.

### consumption

- **consumption.api.ts:** centraliza llamadas HTTP del módulo consumption.
- **DailyConsumptionChart.tsx:** dibuja la visualización Daily Consumption Chart para consumo.
- **WeeklyConsumptionChart.tsx:** dibuja la visualización Weekly Consumption Chart para consumo.
- **ConsumptionPage.tsx:** renderiza la pantalla principal del módulo consumption.

### dashboard

- **DashboardPage.tsx:** renderiza la pantalla principal del módulo dashboard.

### devices

- **devices.api.ts:** centraliza llamadas HTTP del módulo devices.
- **DevicesPage.tsx:** renderiza la pantalla principal del módulo devices.
- **deviceProvisioning.ts:** coordina el flujo web de aprovisionamiento y configuración del ESP32.

### goals

- **GoalsPage.tsx:** renderiza la pantalla principal del módulo goals.

### homes

- **homes.api.ts:** centraliza llamadas HTTP del módulo homes.
- **HomesPage.tsx:** renderiza la pantalla principal del módulo homes.
- **MembershipRequestsPanel.tsx:** presenta el componente reutilizable Membership Requests Panel del módulo homes.

### privacy

- **PrivacyPage.tsx:** renderiza la pantalla principal del módulo privacy.

### recommendations

- **RecommendationsPage.tsx:** renderiza la pantalla principal del módulo recommendations.

### reports

- **ReportsPage.tsx:** renderiza la pantalla principal del módulo reports.

### settings

- **SettingsPage.tsx:** renderiza la pantalla principal del módulo settings.

### support

- **SupportPage.tsx:** renderiza la pantalla principal del módulo support.
- **TechnicianPage.tsx:** renderiza la pantalla principal del módulo support.

### vacation

- **VacationPage.tsx:** renderiza la pantalla principal del módulo vacation.


## Regla de mantenimiento

Una pantalla nueva debe vivir en el módulo de negocio que le corresponde. Si
necesita consultar el backend, añade o amplía el archivo api del mismo módulo;
no implementes fetch directamente en el componente visual.
