import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { MODULE_LABELS, useTenantModules, type ModuleKey } from './useTenantModules'

const TOGGLEABLE_MODULES: ModuleKey[] = ['crm', 'purchasing', 'billing']

export function SettingsPage() {
  const { isEnabled, setModuleEnabled, loading } = useTenantModules()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Configuración</h1>
        <p className="text-muted-foreground text-sm">
          Módulos activos para Del Campo. Caja, Catálogo e Inventario son el núcleo del sistema y
          siempre están disponibles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Módulos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {TOGGLEABLE_MODULES.map((key) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium">{MODULE_LABELS[key].name}</p>
                <p className="text-muted-foreground text-xs">{MODULE_LABELS[key].description}</p>
              </div>
              <Switch
                checked={isEnabled(key)}
                disabled={loading}
                onCheckedChange={(checked) => setModuleEnabled(key, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
