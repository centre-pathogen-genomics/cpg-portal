import type { Param, ParamVisibilityOperator } from "@/client"

/**
 * The parts of a file a run form needs: the value it stores, whether it stands
 * for a group, and how many files that group holds. The portal's file records
 * and a local path both satisfy it.
 */
export interface FileUnit {
  id: string
  is_group?: boolean
  children?: readonly unknown[] | null
}

export function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "number" && Number.isNaN(value))
  )
}

export function parseVisibilityValue(
  value: unknown,
  param: Param,
  operator: ParamVisibilityOperator,
) {
  const parseScalar = (rawValue: unknown) => {
    if (rawValue === null || rawValue === undefined || rawValue === "")
      return null

    if (param.param_type === "bool") {
      if (typeof rawValue === "boolean") return rawValue
      if (typeof rawValue === "string") {
        const lowered = rawValue.trim().toLowerCase()
        if (["true", "1", "yes", "on"].includes(lowered)) return true
        if (["false", "0", "no", "off"].includes(lowered)) return false
      }
      return null
    }

    if (param.param_type === "int") {
      const parsed = Number.parseInt(String(rawValue), 10)
      return Number.isNaN(parsed) ? null : parsed
    }

    if (param.param_type === "float") {
      const parsed = Number.parseFloat(String(rawValue))
      return Number.isNaN(parsed) ? null : parsed
    }

    return String(rawValue)
  }

  if (
    operator === "truthy" ||
    operator === "falsy" ||
    operator === "is_set" ||
    operator === "is_empty"
  ) {
    return null
  }

  if (operator === "in" || operator === "not_in") {
    if (value === null || value === undefined) return []
    if (Array.isArray(value)) return value.map((item) => parseScalar(item))
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => parseScalar(item))
    }
    return [parseScalar(value)]
  }

  if (value === null || value === undefined || value === "") return null

  return parseScalar(value)
}

export function matchesVisibilityCondition({
  dependencyValue,
  operator,
  expectedValue,
}: {
  dependencyValue: unknown
  operator: ParamVisibilityOperator
  expectedValue: unknown
}) {
  if (operator === "truthy") return Boolean(dependencyValue)
  if (operator === "falsy") return !dependencyValue
  if (operator === "is_set") return !isEmptyValue(dependencyValue)
  if (operator === "is_empty") return isEmptyValue(dependencyValue)

  if (operator === "equals") return dependencyValue === expectedValue
  if (operator === "not_equals") return dependencyValue !== expectedValue
  if (operator === "in") {
    if (Array.isArray(expectedValue)) {
      if (Array.isArray(dependencyValue)) {
        return dependencyValue.some((item) => expectedValue.includes(item))
      }
      return expectedValue.includes(dependencyValue)
    }
    return false
  }
  if (operator === "not_in") {
    if (Array.isArray(expectedValue)) {
      if (Array.isArray(dependencyValue)) {
        return dependencyValue.every((item) => !expectedValue.includes(item))
      }
      return !expectedValue.includes(dependencyValue)
    }
    return true
  }
  if (
    typeof dependencyValue !== "number" ||
    typeof expectedValue !== "number"
  ) {
    return false
  }
  if (operator === "greater_than") return dependencyValue > expectedValue
  if (operator === "greater_than_or_equal")
    return dependencyValue >= expectedValue
  if (operator === "less_than") return dependencyValue < expectedValue
  if (operator === "less_than_or_equal") return dependencyValue <= expectedValue
  return false
}

export function buildVisibilityMap(
  params: Param[],
  values: Record<string, unknown>,
): Map<string, boolean> {
  const paramsByName = new Map(params.map((param) => [param.name, param]))
  const cache = new Map<string, boolean>()
  const visiting = new Set<string>()

  const getVisible = (name: string): boolean => {
    const cached = cache.get(name)
    if (cached !== undefined) return cached
    if (visiting.has(name)) return false

    const param = paramsByName.get(name)
    if (!param) return true

    visiting.add(name)
    let visible = true
    if (param.visible_if_param) {
      const dependency = paramsByName.get(param.visible_if_param)
      if (!dependency) {
        visible = false
      } else if (getVisible(dependency.name)) {
        const dependencyValue = values[dependency.name] ?? dependency.default
        const operator = param.visible_if_operator ?? "equals"
        const expectedValue = parseVisibilityValue(
          param.visible_if_value,
          dependency,
          operator,
        )
        visible = matchesVisibilityCondition({
          dependencyValue,
          operator,
          expectedValue,
        })
      } else {
        visible = false
      }
    }
    visiting.delete(name)
    cache.set(name, visible)
    return visible
  }

  for (const param of params) getVisible(param.name)
  return cache
}

// The CPUs the chosen files call for: only a multiple file parameter that
// names a cpus_per_file scales at all. A group counts as the files it holds
// and a pair stays one unit of work, exactly as the backend counts them.
export function countFileCpus(
  params: Param[],
  filesByParam: Map<string, FileUnit[]>,
  values: Record<string, unknown>,
): number {
  return params.reduce((count, param) => {
    if (!param.multiple || param.param_type !== "file") return count
    const configured = param.cpus_per_file ?? 0
    if (configured <= 0) return count
    const byId = new Map(
      (filesByParam.get(param.name) ?? []).map((file) => [file.id, file]),
    )
    const chosen = (values[param.name] as string[] | undefined) ?? []
    const units = chosen.reduce((total, id) => {
      const file = byId.get(id)
      return total + (file?.is_group ? (file.children?.length ?? 1) : 1)
    }, 0)
    return count + units * configured
  }, 0)
}
