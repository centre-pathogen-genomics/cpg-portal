import { VegaEmbed, VegaEmbedProps } from "react-vega";
import { useSuspenseQuery } from '@tanstack/react-query';
import { downloadFileOptions } from '../../client/@tanstack/react-query.gen';
import { useColorModeValue, VStack, Select } from "@chakra-ui/react";
import { useState } from "react";

interface VegaFileProps {
  fileId: string;
  height?: number;
}

const VegaFile = ({ fileId, height = 500 }: VegaFileProps) => {
  // Fetch the text file content
  const { data: vega } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  });

  const defaultTheme = useColorModeValue(undefined, 'dark');
  const [selectedTheme, setSelectedTheme] = useState<string | undefined>(defaultTheme);

  const themes = [
    {value: undefined, label: 'Vega' },
    { value: 'carbong10', label: 'Carbon G10' },
    { value: 'carbong100', label: 'Carbon G100' },
    { value: 'dark', label: 'Dark' },
    { value: 'excel', label: 'Excel' },
    { value: 'fivethirtyeight', label: 'FiveThirtyEight' },
    { value: 'ggplot2', label: 'ggplot2' },
    { value: 'googlecharts', label: 'Google Charts' },
    { value: 'latimes', label: 'LA Times' },
    { value: 'powerbi', label: 'Power BI' },
    { value: 'quartz', label: 'Quartz' },
    { value: 'urbaninstitute', label: 'Urban Institute' },
    { value: 'vox', label: 'Vox' },
  ];

  return (
    <VStack align="start" spacing={3}>
      <Select
        value={selectedTheme}
        onChange={(e) => setSelectedTheme(e.target.value)}
        maxW="300px"
      >
        {themes.map((theme) => (
          <option key={theme.value} value={theme.value}>
            {theme.label}
          </option>
        ))}
      </Select>
      <VegaEmbed spec={vega as object} options={{ height: height, theme: selectedTheme as NonNullable<VegaEmbedProps['options']>['theme'] }} />
    </VStack>
  );
};

export default VegaFile;
