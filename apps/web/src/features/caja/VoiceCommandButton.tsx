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

// Se usa tanto para lo que se dice cuando el match es confiado (ya se
// agregó, es un aviso) como para lo que se muestra/dice cuando hace
// falta elegir en el selector (todavía es una pregunta) -- por eso
// "agregado" en vez de "¿lo agrego?": con match confiado ya no hay
// nada que confirmar, el aviso llega después del hecho.
function describe(command: VoiceCommand, product: Product): string {
  if (command.kind === 'amount') return `Agregado: ${formatCurrency(command.amountMxn)} de ${product.name}`
  if (command.kind === 'quantity') return `Agregado: ${command.quantity} de ${product.name}`
  if (command.kind === 'weight') return `Agregado: ${formatGrams(command.grams)} de ${product.name}`
  // Sin número dicho: si es a granel no hay nada que agregar todavía
  // (applyCommand abre el diálogo de báscula), para los demás sí ya se
  // agregó 1 pieza.
  return product.sold_by_weight ? `${product.name}, pésalo y confirma` : `Agregado: ${product.name}`
}

// Voz es otra forma de llenar el mismo carrito que llenaría un clic o
// un escaneo. Cuando el match de producto es confiado, agrega directo
// sin ningún tap -- incluido el peso, que hasta el 2026-09-14 siempre
// paraba en el diálogo de báscula para que alguien confirmara el peso
// real contra lo pedido. Decisión explícita del dueño ese día, contra
// la recomendación original (que era dejar ese único tap): ya no hay
// ningún punto donde el sistema verifique el gramaje dicho contra una
// báscula real -- lo que se dice en voz alta es, desde entonces, lo
// que se cobra. El candado real de create_sale sigue siendo el
// servidor (el precio nunca sale de lo que dice el cliente); esto solo
// decide qué cantidad/peso/monto se manda. Si el reconocimiento
// mal-entiende un número seguido, revertir este commit deja el sistema
// exactamente como estaba (selector siempre visible, peso siempre por
// báscula).
export function VoiceCommandButton({
  products,
  onAddByAmount,
  onAddByQuantity,
  onAddByWeight,
  onOpenManualWeight,
}: {
  products: Product[]
  onAddByAmount: (product: Product, amountMxn: number) => void
  onAddByQuantity: (product: Product, quantity: number) => void
  onAddByWeight: (product: Product, grams: number) => void
  onOpenManualWeight: (product: Product) => void
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

    // "Confiado" salta el selector de producto y agrega directo,
    // cualquiera que sea el tipo de comando (ver comentario de arriba
    // del componente). Cuando NO es confiado (match ambiguo, más de un
    // producto parecido) el selector se sigue mostrando siempre -- ahí
    // sí hace falta que una persona elija, independientemente de qué
    // tan directo sea el resto del flujo.
    if (confident) {
      speak(describe(command, top.item))
      applyCommand(top.item, command)
      return
    }

    setPending({ command, candidates })
    speak('No estoy seguro, elige el producto correcto.')
  }

  const applyCommand = (product: Product, command: VoiceCommand) => {
    if (command.kind === 'amount') {
      onAddByAmount(product, command.amountMxn)
    } else if (command.kind === 'quantity') {
      onAddByQuantity(product, command.quantity)
    } else if (command.kind === 'weight') {
      onAddByWeight(product, command.grams)
    } else if (product.sold_by_weight) {
      // Sin número dicho ("chile puya" a secas) no hay nada que agregar
      // directo -- no hay peso que mandar, así que aquí sí hace falta
      // la báscula y el diálogo manual, igual que un clic normal.
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
