import { useState, Suspense } from 'react';
import { 
  TableContainer, 
  Table, 
  Thead, 
  Tbody, 
  Tr, 
  Th, 
  Td, 
  Skeleton, 
  Flex
} from '@chakra-ui/react';
import Papa from 'papaparse'; // CSV parsing library
import { useSuspenseQuery } from '@tanstack/react-query';
import { FilesService } from '../../client';
import { PaginationFooter } from '../../components/Common/PaginationFooter';
import DownloadFileButton from '../Files/DownloadFileButton';

interface CsvFileToTableProps {
  fileId: string;
}

const CsvFileToTable = ({ fileId }: CsvFileToTableProps) => {
  // Use useSuspenseQuery to fetch the file
  const { data: csvText } = useSuspenseQuery({
    queryKey: ["file", { id: fileId }],
    queryFn: () => FilesService.downloadFile({ id: fileId }),
  });

  // Parse CSV data
  const parsedData = Papa.parse(csvText as string, { header: true });
  const headers = Object.keys(parsedData.data[0] || {}); // Extract headers
  const tableData = (parsedData.data as { [key: string]: any }[]).filter(row => 
    Object.values(row).some(val => val !== '')
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1); // Start at page 1
  const rowsPerPage = 10;

  const totalPages = Math.ceil(tableData.length / rowsPerPage);
  const paginatedData = tableData.slice(
    (currentPage - 1) * rowsPerPage, // Adjust for 1-based index
    currentPage * rowsPerPage
  );

  // PaginationFooter props
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) { // 1-based bounds
      setCurrentPage(newPage);
    }
  };

  return (
    <Suspense fallback={<Skeleton height="20px" />}>
      <TableContainer>
        <Table variant="simple">
          <Thead>
            <Tr>
              {headers.map((header, idx) => (
                <Th key={idx} isNumeric={header.toLowerCase().includes('multiply')}>
                  {header}
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {paginatedData.map((row, rowIndex) => (
              <Tr key={rowIndex}>
                {headers.map((header, colIndex) => (
                  <Td key={colIndex} isNumeric={header.toLowerCase().includes('multiply')}>
                    {row[header]}
                  </Td>
                ))}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
      <Flex justify="space-between" mt={4}>
        <DownloadFileButton fileId={fileId} />
        <PaginationFooter
          page={currentPage} // 1-based
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          onChangePage={handlePageChange}
        />
      </Flex>
    </Suspense>
  );
};

export default CsvFileToTable;
