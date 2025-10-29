import { useState, Component, ReactNode } from 'react';
import { SeqViz } from "seqviz";
import seqparse, { Seq } from "seqparse";
import { useSuspenseQuery } from '@tanstack/react-query';
import { downloadFileOptions } from '../../client/@tanstack/react-query.gen';
import { VStack, Select, Text, useColorMode, Box } from '@chakra-ui/react';


interface GenbankFileProps {
  fileId: string;
  viewer?: 'linear' | 'circular' | 'both';
  height?: number;
}

// Error Boundary to catch parsing errors
class GenbankErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <Text color="red.500">Could not parse GenBank file</Text>;
    }
    return this.props.children;
  }
}

const GenbankFileContent = ({ fileId, height = 500, viewer = "both"  }: GenbankFileProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { colorMode } = useColorMode();

  // Fetch the GenBank file content
  const { data: genbankContent } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  });

  const genbank = typeof genbankContent === 'string'
    ? genbankContent
    : new TextDecoder().decode(genbankContent as ArrayBuffer);

  // Parse GenBank file - seqparse handles GenBank format directly
  const { data: parsed } = useSuspenseQuery<Seq | Seq[]>({
    queryKey: ['genbank-parse', fileId, genbank],
    queryFn: async () => {
      const result = await seqparse(genbank, { fileName: 'file.gb' });
      return result;
    },
    retry: false,
  });

  if (!parsed) {
    return <Text color="gray.500">No sequences found in GenBank file</Text>;
  }

  // Handle both single and multi-sequence GenBank files
  const sequences = Array.isArray(parsed) ? parsed : [parsed];
  
  if (sequences.length === 0) {
    return <Text color="gray.500">No sequences found in GenBank file</Text>;
  }

  const currentSeq = sequences[selectedIndex];

  if (!currentSeq) {
    return <Text color="gray.500">Invalid sequence selected</Text>;
  }

  const { name, seq, annotations } = currentSeq;

  console.log("Current Sequence:", currentSeq);

  // Adapt colors for dark/light mode
  const bpColors = colorMode === 'dark' 
    ? { A: '#42a5f5', T: '#ef5350', C: '#66bb6a', G: '#ffa726' }
    : { A: '#1976d2', T: '#d32f2f', C: '#388e3c', G: '#f57c00' };

  const textColor = colorMode === 'dark' ? '#e0e0e0' : '#2a2a2a';

  return (
    <VStack align="stretch" spacing={3}>
      {sequences.length > 1 && (
        <Select
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          maxW="400px"
        >
          {sequences.map((s, idx) => (
            <option key={idx} value={idx}>
              {s.name || `Sequence ${idx + 1}`} ({s.seq?.length || 0} bp)
            </option>
          ))}
        </Select>
      )}
      <Box
        sx={{
          '& svg text': {
            fill: `${textColor} !important`,
          }
        }}
      >
        <SeqViz
          seq={seq}
          annotations={annotations}
          name={name}
          viewer={viewer}
          style={{ height: `${height}px`, width: '100%'}}
          bpColors={bpColors}
          showComplement={false}
        />
      </Box>
    </VStack>
  );
};

const GenbankFile = (props: GenbankFileProps) => {
  return (
    <GenbankErrorBoundary>
      <GenbankFileContent {...props} />
    </GenbankErrorBoundary>
  );
};

export default GenbankFile;
