import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Database } from '@/lib/database.types'
import { ProductsTab } from './ProductsTab'
import { CategoriesTab } from './CategoriesTab'
import { UnitsTab } from './UnitsTab'

type Role = Database['public']['Enums']['user_role']

export function CatalogPage({ role }: { role: Role | null }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Catálogo</h1>
        <p className="text-muted-foreground text-sm">
          Productos, categorías y unidades de medida de Del Campo.
        </p>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
          <TabsTrigger value="units">Unidades</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <ProductsTab role={role} />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="units">
          <UnitsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
