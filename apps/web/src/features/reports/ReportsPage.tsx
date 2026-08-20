import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/currency'
import { useSalesReport } from './useSalesReport'
import { useSales } from './useSales'

type PresetKey = 'today' | 'week' | 'month'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Últimos 7 días' },
  { key: 'month', label: 'Este mes' },
]

function rangeFor(preset: PresetKey) {
  const now = new Date()
  const to = now.toISOString()
  const from = new Date(now)

  if (preset === 'today') {
    from.setHours(0, 0, 0, 0)
  } else if (preset === 'week') {
    from.setDate(from.getDate() - 6)
    from.setHours(0, 0, 0, 0)
  } else {
    from.setDate(1)
    from.setHours(0, 0, 0, 0)
  }

  return { from: from.toISOString(), to }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ReportsPage() {
  const [preset, setPreset] = useState<PresetKey>('today')
  const { from, to } = useMemo(() => rangeFor(preset), [preset])
  const report = useSalesReport(from, to)
  const { sales, voidSale } = useSales(from, to)

  const handleVoid = async (saleId: string, total: number) => {
    if (
      !window.confirm(
        `¿Anular esta venta de ${formatCurrency(total)}? Repone el inventario vendido.`,
      )
    ) {
      return
    }
    const ok = await voidSale(saleId)
    if (ok) await report.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Reportes</h1>
          <p className="text-muted-foreground text-sm">
            Ventas e historial de caja del periodo.
          </p>
        </div>
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              variant={preset === p.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">
              Total vendido
            </CardTitle>
          </CardHeader>
          <CardContent className="text-brand-gold text-2xl font-semibold">
            {formatCurrency(report.totalAmount)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">
              Utilidad
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-baseline gap-2 text-2xl font-semibold">
            {formatCurrency(report.margin)}
            <span className="text-muted-foreground text-sm font-normal">
              {report.marginPercent.toFixed(0)}%
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">
              Ventas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {report.saleCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">
              Ticket promedio
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(report.avgTicket)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por método de pago</CardTitle>
          </CardHeader>
          <CardContent>
            {report.byPaymentMethod.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Sin ventas en este periodo.
              </p>
            ) : (
              <Table>
                <TableBody>
                  {report.byPaymentMethod.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productos más vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {report.topProducts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Sin ventas en este periodo.
              </p>
            ) : (
              <Table>
                <TableBody>
                  {report.topProducts.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin ventas en este periodo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Cajero</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>{formatDateTime(sale.createdAt)}</TableCell>
                    <TableCell>{sale.soldBy}</TableCell>
                    <TableCell>{formatCurrency(sale.total)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          sale.status === 'voided' ? 'secondary' : 'default'
                        }
                      >
                        {sale.status === 'voided' ? 'Anulada' : 'Completada'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {sale.status === 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVoid(sale.id, sale.total)}
                        >
                          Anular
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cortes de caja del periodo</CardTitle>
        </CardHeader>
        <CardContent>
          {report.cashSessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No hay cortes de caja cerrados en este periodo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cerrada</TableHead>
                  <TableHead>Cajero</TableHead>
                  <TableHead>Monto inicial</TableHead>
                  <TableHead>Ventas en efectivo</TableHead>
                  <TableHead>Esperado</TableHead>
                  <TableHead>Contado</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.cashSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{formatDateTime(session.closedAt)}</TableCell>
                    <TableCell>{session.openedBy}</TableCell>
                    <TableCell>
                      {formatCurrency(session.openingAmount)}
                    </TableCell>
                    <TableCell>{formatCurrency(session.cashSales)}</TableCell>
                    <TableCell>
                      {formatCurrency(session.expectedClosing)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(session.closingAmount)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        session.difference === 0
                          ? 'text-success'
                          : session.difference < 0
                            ? 'text-destructive'
                            : 'text-brand-gold'
                      }`}
                    >
                      {session.difference === 0
                        ? 'Cuadra'
                        : formatCurrency(session.difference)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
