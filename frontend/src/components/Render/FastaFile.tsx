import { useState } from 'react';
import { SeqViz } from "seqviz";
import seqparse, { Seq } from "seqparse";
import { useSuspenseQuery } from '@tanstack/react-query';
import { downloadFileOptions } from '../../client/@tanstack/react-query.gen';
import { VStack, Select, Text, useColorMode, Box } from '@chakra-ui/react';


interface FastaFileProps {
  fileId: string;
  height?: number;
}

const FastaFile = ({ fileId, height = 500  }: FastaFileProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { colorMode } = useColorMode();

  // Fetch the text file content
  const { data: fastaContent } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  });

  const fasta = typeof fastaContent === 'string'
    ? fastaContent
    : new TextDecoder().decode(fastaContent as ArrayBuffer);



  // Parse each FASTA entry
  const { data: parsed } = useSuspenseQuery<Seq[]>({
    queryKey: ['fasta-parse', fileId, fasta],
    queryFn: async () => {
      try {
          // Split multi-FASTA file into individual sequences
        const fastaEntries = fasta.split(/(?=^>)/m).filter(entry => entry.trim());
        const sequences = await Promise.all(
          fastaEntries.map(entry => seqparse(entry))
        );
        return sequences;
      } catch (e) {
        console.error("Fasta parsing failed:", e);
        throw e;
      }
    },
  });

  if (!parsed || parsed.length === 0) {
    return <Text color="gray.500">No sequences found in FASTA file</Text>;
  }

  // All sequences are already in an array
  const sequences = parsed;
  const currentSeq = sequences[selectedIndex];

  if (!currentSeq) {
    return <Text color="gray.500">No sequences found in FASTA file</Text>;
  }

  const { name, seq, annotations } = currentSeq;

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
          viewer='both'
          style={{ height: `${height}px`, width: '100%'}}
          bpColors={bpColors}
          showComplement={false}
        />
      </Box>
    </VStack>
  );
};

export default FastaFile;
