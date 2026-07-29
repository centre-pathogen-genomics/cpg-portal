import { useSuspenseQuery } from "@tanstack/react-query"
import Papa from "papaparse" // CSV parsing library
import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { downloadFileOptions } from "../../client/@tanstack/react-query.gen"
import { PaginationFooter } from "../../components/Common/PaginationFooter"

interface CsvFileToTableProps {
  fileId: string
  tsv?: boolean
}

const CsvFileToTable = ({ fileId, tsv = false }: CsvFileToTableProps) => {
  const [currentPage, setCurrentPage] = useState(1)

  // Use useSuspenseQuery to fetch the file
  const { data: csvText } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  })

  // Parse CSV data
  let parsedData = { data: [] }
  try {
    parsedData = Papa.parse(csvText as string, {
      header: true,
      delimiter: tsv ? "\t" : ",",
    })
  } catch (_error) {
    return <Skeleton className="h-5" />
  }
  const headers = Object.keys(parsedData.data[0] || {}) // Extract headers
  const tableData = (parsedData.data as { [key: string]: any }[]).filter(
    (row) => Object.values(row).some((val) => val !== ""),
  )

  const rowsPerPage = 10

  const totalPages = Math.ceil(tableData.length / rowsPerPage)
  const paginatedData = tableData.slice(
    (currentPage - 1) * rowsPerPage, // Adjust for 1-based index
    currentPage * rowsPerPage,
  )

  // PaginationFooter props
  const hasNextPage = currentPage < totalPages
  const hasPreviousPage = currentPage > 1

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      // 1-based bounds
      setCurrentPage(newPage)
    }
  }

  return (
    <>
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header, idx) => (
                <TableHead
                  key={idx}
                  className={
                    header.toLowerCase().includes("multiply")
                      ? "text-right"
                      : undefined
                  }
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {headers.map((header, colIndex) => (
                  <TableCell
                    key={colIndex}
                    className={
                      header.toLowerCase().includes("multiply")
                        ? "text-right"
                        : undefined
                    }
                  >
                    {row[header]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 flex justify-start">
        <PaginationFooter
          page={currentPage} // 1-based
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          onChangePage={handlePageChange}
        />
      </div>
    </>
  )
}

export default CsvFileToTable
