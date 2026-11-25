import { TextInput } from "./field";

/** Decimal amount input: keeps digits and a dot, nothing else. */
export function AmountInput({
  value,
  onChange,
  placeholder = "0.00",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <TextInput
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
      placeholder={placeholder}
      inputMode="decimal"
    />
  );
}
