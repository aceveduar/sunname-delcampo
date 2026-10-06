/** Keeps a presentation such as "110 G" together without changing catalog data. */
export function ProductName({ name }: { name: string }) {
  const parts = name.split(
    /(\b\d+(?:[.,]\d+)*[ \t]+(?:kg|mg|g|ml|cl|l|oz|lb)\b)/gi,
  )
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  )
}
