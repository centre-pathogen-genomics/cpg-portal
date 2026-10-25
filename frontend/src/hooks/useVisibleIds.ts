import { type Dispatch, type SetStateAction, useEffect } from "react"

interface Identifiable {
  id: string
}

const includeAllRows = () => true

export function useVisibleIds<T extends Identifiable>(
  rows: T[],
  setVisibleIds: Dispatch<SetStateAction<string[]>>,
  includeRow: (row: T) => boolean = includeAllRows,
) {
  useEffect(() => {
    const nextVisibleIds = rows.filter(includeRow).map((row) => row.id)

    setVisibleIds((currentVisibleIds) => {
      if (
        currentVisibleIds.length === nextVisibleIds.length &&
        currentVisibleIds.every((id, index) => id === nextVisibleIds[index])
      ) {
        return currentVisibleIds
      }

      return nextVisibleIds
    })
  }, [includeRow, rows, setVisibleIds])
}
