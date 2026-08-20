import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PurchaseOrdersTab } from './PurchaseOrdersTab'
import { SuppliersTab } from './SuppliersTab'

export function PurchasingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Compras</h1>
        <p className="text-muted-foreground text-sm">Proveedores y órdenes de compra.</p>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Órdenes de compra</TabsTrigger>
          <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <PurchaseOrdersTab />
        </TabsContent>
        <TabsContent value="suppliers">
          <SuppliersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
