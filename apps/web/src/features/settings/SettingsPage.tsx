import { Settings2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { LoadError } from '@/components/LoadError'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  MODULE_LABELS,
  type ModuleKey,
  type useTenantModules,
} from './useTenantModules'
import { useTenantSettings } from './useTenantSettings'
import { useTenantFiscalSettings } from './useTenantFiscalSettings'
import { BusinessNameForm, FiscalSettingsForm } from './SettingsForms'

const TOGGLEABLE_MODULES: ModuleKey[] = ['crm', 'purchasing', 'billing']

export function SettingsPage({
  tenantModules,
}: {
  tenantModules: ReturnType<typeof useTenantModules>
}) {
  const name = useTenantSettings()
  const fiscal = useTenantFiscalSettings()
  const {
    isEnabled,
    setModuleEnabled,
    loading,
    error,
    refresh,
    saving,
    saveErrors,
  } = tenantModules
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Settings2}
        title="Configuración"
        description="Tu negocio, tus preferencias. Personaliza la información y los módulos disponibles."
      />
      <Card>
        <CardHeader>
          <CardTitle>Nombre del negocio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Aparece en los tickets de tus clientes. El menú mantiene la
            identidad de Sunname ERP.
          </p>
          <LoadError
            message={name.error}
            onRetry={name.refresh}
            loading={name.loading}
          />
          {name.loading && !name.error && (
            <p role="status" className="text-muted-foreground text-sm">
              Cargando nombre del negocio…
            </p>
          )}
          {name.ready && (
            <BusinessNameForm
              initialName={name.businessName}
              onSave={name.updateBusinessName}
            />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Módulos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Activa las herramientas que usa tu negocio. Los cambios se reflejan
            en el menú al guardarse.
          </p>
          <LoadError message={error} onRetry={refresh} loading={loading} />
          <div className="divide-border divide-y">
            {TOGGLEABLE_MODULES.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                aria-busy={saving.has(key)}
              >
                <div className="min-w-0">
                  <p id={`module-${key}-label`} className="text-sm font-medium">
                    {MODULE_LABELS[key].name}
                  </p>
                  <p
                    id={`module-${key}-description`}
                    className="text-muted-foreground text-xs"
                  >
                    {MODULE_LABELS[key].description}
                  </p>
                  {saving.has(key) && (
                    <p
                      role="status"
                      className="text-muted-foreground mt-1 text-xs"
                    >
                      Guardando…
                    </p>
                  )}
                  {saveErrors[key] && (
                    <p role="alert" className="text-destructive mt-1 text-xs">
                      {saveErrors[key]}
                    </p>
                  )}
                </div>
                <Switch
                  aria-labelledby={`module-${key}-label`}
                  aria-describedby={`module-${key}-description`}
                  checked={isEnabled(key)}
                  disabled={loading || !!error || saving.has(key)}
                  onCheckedChange={(checked) => {
                    void setModuleEnabled(key, checked)
                  }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Datos fiscales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Guarda los datos fiscales del negocio. El timbrado con un PAC
            todavía no está conectado.
          </p>
          <LoadError
            message={fiscal.error}
            onRetry={fiscal.refresh}
            loading={fiscal.loading}
          />
          {fiscal.loading && !fiscal.error && (
            <p role="status" className="text-muted-foreground text-sm">
              Cargando datos fiscales…
            </p>
          )}
          {fiscal.ready && (
            <FiscalSettingsForm
              initialSettings={fiscal.settings}
              onSave={fiscal.updateSettings}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
