import { useEffect, useRef } from 'react'

interface Props {
  value: string
  swatches: readonly string[]
  onCommit: (color: string) => void
}

/**
 * 프리셋 색 + 직접 선택. 색상 선택기는 드래그 중 input 이벤트가 계속 오므로
 * 선택기를 닫을 때 오는 네이티브 change 이벤트에서만 확정한다(히스토리 1건).
 */
export function ColorField({ value, swatches, onCommit }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.value = value
    const onChange = () => commitRef.current(el.value)
    el.addEventListener('change', onChange)
    return () => el.removeEventListener('change', onChange)
  }, [value])

  return (
    <div className="swatches">
      {swatches.map((c) => (
        <button
          key={c}
          className="swatch"
          style={{ background: c }}
          aria-label={c}
          aria-pressed={c.toLowerCase() === value.toLowerCase()}
          onClick={() => c !== value && onCommit(c)}
        />
      ))}
      <input ref={inputRef} type="color" defaultValue={value} aria-label="직접 선택" />
    </div>
  )
}
