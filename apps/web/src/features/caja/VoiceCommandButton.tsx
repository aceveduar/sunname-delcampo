import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/currency'
import { parseVoiceCommand, rankVoiceCandidates, type VoiceCandidate, type VoiceCommand } from '@/lib/voice'
import type { Product } from '@/features/catalog/useProducts'
import { useVoiceCommand } from './useVoiceCommand'

const MAX_CANDIDATES = 3

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'es-MX'
  window.speechSynthesis.speak(utterance)
}

function formatGrams(grams: number): string {
  return grams % 1000 === 0 ? `${grams / 1000} kg` : `${grams} g`
}

function candidateHint(command: VoiceCommand, product: Product): string {
  if (command.kind === 'amount') return formatCurrency(command.amountMxn)
  if (command.kind === 'quantity') return `x${command.quantity}`
  if (command.kind === 'weight') return formatGrams(command.grams)
  return product.sold_by_weight ? 'Pesar a mano' : 'x1'
}

function describe(command: VoiceCommand, product: Product): string {
  if (command.kind === 'amount') return `${formatCurrency(command.amountMxn)} de ${product.name}, ¿lo agrego?`
  if (command.kind === 'quantity') return `${command.quantity} de ${product.name}, ¿lo agrego?`
  if (command.kind === 'weight') return `${formatGrams(command.grams)} de ${product.name}, confirma el peso`
  return `${product.name}, ¿lo agrego?`
}

// Voz es solo otra forma de llenar el mismo carrito que llenaría un
// clic o un escaneo -- nunca cobra directo de lo reconocido. Todo pasa
// por esta tarjeta de confirmación con tap explícito antes de tocar la
// venta (CLAUDE.md: el candado real de create_sale sigue siendo el
// servidor, esto solo evita que un error de reconocimiento agregue algo
// que nadie pidió).
export function VoiceCommandButton({
  products,
  onAddByAmount,
  onAddByQuantity,
  onOpenManualWeight,
}: {
  products: Product[]
  onAddByAmount: (product: Product, amountMxn: number) => void
  onAddByQuantity: (product: Product, quantity: number) => void
  onOpenManualWeight: (product: Product, initialGrams?: number) => void
}) {
  const { supported, listening, transcript, error, start, stop } = useVoiceCommand()
  const [pending, setPending] = useState<{
    command: VoiceCommand
    candidates: VoiceCandidate<Product>[]
  } | null>(null)

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  const handleFinalTranscript = (text: string) => {
    const command = parseVoiceCommand(text)
    if (!command) {
      toast.error(`No entendí "${text}". Intenta de nuevo.`)
      return
    }

    const pool =
      command.kind === 'amount' || command.kind === 'weight'
        ? products.filter((p) => p.active && p.sold_by_weight)
        : command.kind === 'quantity'
          ? products.filter((p) => p.active && !p.sold_by_weight)
          : products.filter((p) => p.active)

    const ranked = rankVoiceCandidates(command.productQuery, pool, (p) => p.name)
    if (ranked.length === 0) {
      toast.error(`No encontré ningún producto parecido a "${command.productQuery}".`)
      return
    }

    // Una palabra muy genérica ("chile" solo, sin apellido) empata en el
    // primer lugar contra más productos de los que caben en la tarjeta --
    // enseñar 3 al azar de esos empatados es peor que pedir que sea más
    // específico: el que se quería podría ni aparecer.
    const topScore = ranked[0].score
    const tiedAtTop = ranked.filter((c) => c.score === topScore).length
    if (tiedAtTop > MAX_CANDIDATES) {
      toast.error(
        `"${command.productQuery}" es muy genérico -- hay ${tiedAtTop} productos parecidos. Sé más específico.`,
      )
      return
    }

    const candidates = ranked.slice(0, MAX_CANDIDATES)
    const [top, second] = candidates
    const confident = top.score >= 0.75 && (candidates.length === 1 || top.score - second.score >= 0.2)

    // "Confiado" salta el selector de producto -- pero solo cuando lo
    // que sigue todavía exige un tap explícito antes de tocar el
    // carrito (peso: el diálogo de báscula, que hay que confirmar
    // después de pesar de verdad). Un monto o una cantidad van directo
    // al carrito sin ningún otro paso -- ahí el selector SIGUE siendo
    // el único tap de seguridad, y no se salta aunque el match sea
    // perfecto: "nunca cobra directo de lo reconocido" no admite
    // excepciones para esos dos casos.
    if (confident && command.kind === 'weight') {
      speak(describe(command, top.item))
      applyCommand(top.item, command)
      return
    }

    setPending({ command, candidates })
    speak(confident ? describe(command, top.item) : 'No estoy seguro, elige el producto correcto.')
  }

  const applyCommand = (product: Product, command: VoiceCommand) => {
    if (command.kind === 'amount') {
      onAddByAmount(product, command.amountMxn)
    } else if (command.kind === 'quantity') {
      onAddByQuantity(product, command.quantity)
    } else if (command.kind === 'weight') {
      onOpenManualWeight(product, command.grams)
    } else if (product.sold_by_weight) {
      onOpenManualWeight(product)
    } else {
      onAddByQuantity(product, 1)
    }
  }

  const handleConfirm = (product: Product) => {
    if (!pending) return
    applyCommand(product, pending.command)
    setPending(null)
  }

  if (!supported) return null

  return (
    <>
      <Button
        type="button"
        variant={listening ? 'default' : 'outline'}
        size="icon"
        aria-label={listening ? 'Escuchando…' : 'Agregar por voz'}
        title={listening ? 'Escuchando…' : 'Agregar por voz'}
        onClick={() => (listening ? stop() : start(handleFinalTranscript))}
        className={listening ? 'animate-pulse' : undefined}
      >
        <Mic />
      </Button>

      {listening && (
        <p className="text-muted-foreground w-full basis-full text-sm italic">
          {transcript ? `"${transcript}"` : 'Escuchando…'}
        </p>
      )}

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Agregar esto?</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {pending?.candidates.map(({ item }) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleConfirm(item)}
                className="hover:bg-muted border-border bg-card flex items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors"
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground text-sm whitespace-nowrap">
                  {pending ? candidateHint(pending.command, item) : ''}
                </span>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
