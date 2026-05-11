export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; field?: string };

type Validator<T> = (value: unknown, field: string) => ValidationResult<T>;

const trim = (value: string) => value.replace(/^\s+|\s+$/g, "");

function stringValidator(options?: { min?: number; max?: number; trim?: boolean }): Validator<string>;
function stringValidator(options: { min?: number; max?: number; trim?: boolean; optional: true }): Validator<string | undefined>;
function stringValidator({
  min,
  max,
  trim: shouldTrim = true,
  optional = false
}: { min?: number; max?: number; trim?: boolean; optional?: boolean } = {}): Validator<string | undefined> {
  return (value, field) => {
    if (value === undefined || value === null || value === "") {
      if (optional) return { ok: true, value: undefined };
      return { ok: false, error: `Falta el campo "${field}".`, field };
    }
    if (typeof value !== "string") {
      return { ok: false, error: `El campo "${field}" debe ser texto.`, field };
    }
    const normalized = shouldTrim ? trim(value) : value;
    if (!optional && normalized.length === 0) {
      return { ok: false, error: `El campo "${field}" no puede estar vacío.`, field };
    }
    if (min !== undefined && normalized.length < min) {
      return { ok: false, error: `El campo "${field}" debe tener al menos ${min} caracteres.`, field };
    }
    if (max !== undefined && normalized.length > max) {
      return { ok: false, error: `El campo "${field}" no puede superar los ${max} caracteres.`, field };
    }
    return { ok: true, value: normalized };
  };
}

function emailValidator(): Validator<string> {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return (value, field) => {
    if (typeof value !== "string") return { ok: false, error: `El email es obligatorio.`, field };
    const normalized = trim(value).toLowerCase();
    if (!pattern.test(normalized)) return { ok: false, error: `Introduce un email válido.`, field };
    if (normalized.length > 254) return { ok: false, error: `El email es demasiado largo.`, field };
    return { ok: true, value: normalized };
  };
}

function integerValidator(options?: { min?: number; max?: number }): Validator<number>;
function integerValidator(options: { min?: number; max?: number; optional: true }): Validator<number | undefined>;
function integerValidator({
  min,
  max,
  optional = false
}: { min?: number; max?: number; optional?: boolean } = {}): Validator<number | undefined> {
  return (value, field) => {
    if (value === undefined || value === null || value === "") {
      if (optional) return { ok: true, value: undefined };
      return { ok: false, error: `Falta el campo "${field}".`, field };
    }
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return { ok: false, error: `El campo "${field}" debe ser un número entero.`, field };
    }
    if (min !== undefined && parsed < min) {
      return { ok: false, error: `El campo "${field}" debe ser al menos ${min}.`, field };
    }
    if (max !== undefined && parsed > max) {
      return { ok: false, error: `El campo "${field}" no puede superar ${max}.`, field };
    }
    return { ok: true, value: parsed };
  };
}

function booleanValidator(options: { defaultValue: boolean }): Validator<boolean>;
function booleanValidator(options?: { optional?: boolean; defaultValue?: boolean }): Validator<boolean | undefined>;
function booleanValidator({
  optional = false,
  defaultValue
}: { optional?: boolean; defaultValue?: boolean } = {}): Validator<boolean | undefined> {
  return (value, field) => {
    if (value === undefined || value === null) {
      if (defaultValue !== undefined) return { ok: true, value: defaultValue };
      if (optional) return { ok: true, value: undefined };
      return { ok: false, error: `Falta el campo "${field}".`, field };
    }
    if (typeof value === "boolean") return { ok: true, value };
    if (value === "true" || value === 1 || value === "1") return { ok: true, value: true };
    if (value === "false" || value === 0 || value === "0") return { ok: true, value: false };
    return { ok: false, error: `El campo "${field}" debe ser booleano.`, field };
  };
}

function enumValidator<T extends string>(values: readonly T[]): Validator<T>;
function enumValidator<T extends string>(values: readonly T[], options: { optional: true }): Validator<T | undefined>;
function enumValidator<T extends string>(
  values: readonly T[],
  { optional = false }: { optional?: boolean } = {}
): Validator<T | undefined> {
  return (value, field) => {
    if (value === undefined || value === null || value === "") {
      if (optional) return { ok: true, value: undefined };
      return { ok: false, error: `Falta el campo "${field}".`, field };
    }
    if (typeof value !== "string" || !values.includes(value as T)) {
      return { ok: false, error: `El campo "${field}" no es válido.`, field };
    }
    return { ok: true, value: value as T };
  };
}

function arrayValidator<T>(item: Validator<T>, options?: { max?: number }): Validator<T[]>;
function arrayValidator<T>(item: Validator<T>, options: { optional: true; max?: number }): Validator<T[] | undefined>;
function arrayValidator<T>(
  item: Validator<T>,
  { optional = false, max }: { optional?: boolean; max?: number } = {}
): Validator<T[] | undefined> {
  return (value, field) => {
    if (value === undefined || value === null) {
      if (optional) return { ok: true, value: undefined };
      return { ok: false, error: `Falta el campo "${field}".`, field };
    }
    if (!Array.isArray(value)) return { ok: false, error: `El campo "${field}" debe ser una lista.`, field };
    if (max !== undefined && value.length > max) {
      return { ok: false, error: `La lista "${field}" no puede tener más de ${max} elementos.`, field };
    }
    const out: T[] = [];
    for (let i = 0; i < value.length; i += 1) {
      const result = item(value[i], `${field}[${i}]`);
      if (!result.ok) return result;
      if (result.value !== undefined) out.push(result.value as T);
    }
    return { ok: true, value: out };
  };
}

function passthroughValidator(): Validator<unknown> {
  return (value) => ({ ok: true, value });
}

export const v = {
  string: stringValidator,
  email: emailValidator,
  integer: integerValidator,
  boolean: booleanValidator,
  enum: enumValidator,
  array: arrayValidator,
  passthrough: passthroughValidator
};

type Schema = Record<string, Validator<any>>;
type Infer<S extends Schema> = {
  [K in keyof S]: S[K] extends Validator<infer T> ? T : never;
};

export function parse<S extends Schema>(schema: S, input: unknown): ValidationResult<Infer<S>> {
  const obj = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, validator] of Object.entries(schema)) {
    const result = validator(obj[key], key);
    if (!result.ok) return result as ValidationResult<Infer<S>>;
    out[key] = result.value;
  }
  return { ok: true, value: out as Infer<S> };
}

export async function parseBody<S extends Schema>(schema: S, request: Request): Promise<ValidationResult<Infer<S>>> {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    return { ok: false, error: "El cuerpo de la petición no es JSON válido." };
  }
  return parse(schema, payload);
}
