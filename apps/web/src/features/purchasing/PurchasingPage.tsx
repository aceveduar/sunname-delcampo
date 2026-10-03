import { PageHeader } from '@/components/PageHeader'
import { ShoppingBag } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PurchaseOrdersTab } from './PurchaseOrdersTab'
import { SuppliersTab } from './SuppliersTab'

export function PurchasingPage({ userId }: { userId: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ShoppingBag}
        title="Compras"
        description="Planea tus compras y da seguimiento a cada entrega."
      />

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Órdenes de compra</TabsTrigger>
          <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <PurchaseOrdersTab userId={userId} />
        </TabsContent>
        <TabsContent value="suppliers">
          <SuppliersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
