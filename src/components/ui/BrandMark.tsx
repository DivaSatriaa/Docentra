import mark from "../../assets/docentra-mark.png"

export default function BrandMark({
  size = 32,
  className = "",
}: {
  size?: number
  className?: string
}) {
  return (
    <img
      src={mark}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={`shrink-0 select-none object-contain ${className}`}
    />
  )
}
