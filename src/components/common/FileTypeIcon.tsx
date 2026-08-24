import pdfIcon from "../../assets/file-icons/pdf.png"
import docIcon from "../../assets/file-icons/doc.png"
import mdIcon from "../../assets/file-icons/md.png"
import txtIcon from "../../assets/file-icons/txt.png"
import pptxIcon from "../../assets/file-icons/pptx.png"
import xlsxIcon from "../../assets/file-icons/xlsx.png"
import csvIcon from "../../assets/file-icons/csv.png"

const fileIcons = {
  pdf: pdfIcon,
  doc: docIcon,
  docx: docIcon,
  md: mdIcon,
  txt: txtIcon,
  pptx: pptxIcon,
  xlsx: xlsxIcon,
  csv: csvIcon,
} as const

type SupportedFileType = keyof typeof fileIcons

interface FileTypeIconProps {
  type: string
  size?: number
  className?: string
}

function normalizeFileType(type: string): SupportedFileType | null {
  const normalized = type
    .toLowerCase()
    .replace(".", "")

  if (normalized in fileIcons) {
    return normalized as SupportedFileType
  }

  return null
}

export default function FileTypeIcon({
  type,
  size = 32,
  className = "",
}: FileTypeIconProps) {
  const normalizedType = normalizeFileType(type)

  if (!normalizedType) {
    return (
      <img
        src={txtIcon}
        alt="File"
        width={size}
        height={size}
        className={`object-contain ${className}`}
      />
    )
  }

  return (
    <img
      src={fileIcons[normalizedType]}
      alt={`${normalizedType.toUpperCase()} file`}
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  )
}
