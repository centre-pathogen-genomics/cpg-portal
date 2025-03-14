/**
 * Checks if two filenames differ by exactly one character,
 * and that the differing character is part of an "R1"/"R2" pattern.
 *
 * This function assumes that if there's a difference, it occurs in the digit after an "R".
 *
 * @param file1 - The first filename.
 * @param file2 - The second filename.
 * @returns true if the filenames differ in exactly one character,
 *          the character is preceded by "R" in both strings,
 *          and that character is "1" in one and "2" in the other.
 */
function isPair(file1: string, file2: string): boolean {
  if (file1.length !== file2.length) return false;
  if (!file1.includes("R1") && !file1.includes("R2")) return false;
  if (!file2.includes("R1") && !file2.includes("R2")) return false;

  let diffIndex = -1;
  for (let i = 0; i < file1.length; i++) {
    if (file1[i] !== file2[i]) {
      if (diffIndex !== -1) {
        // More than one difference found.
        return false;
      }
      diffIndex = i;
    }
  }

  // No difference found, or the difference wasn't found.
  if (diffIndex === -1) return false;

  // Ensure the difference is not at the very start (to safely check the preceding character)
  if (diffIndex === 0) return false;

  // Check that the character before the difference is "R" in both filenames.
  if (file1[diffIndex - 1] !== "R" || file2[diffIndex - 1] !== "R")
    return false;

  // Check that the differing characters are "1" and "2"
  return (
    (file1[diffIndex] === "1" && file2[diffIndex] === "2") ||
    (file1[diffIndex] === "2" && file2[diffIndex] === "1")
  );
}

function isFastqFile(file: File): boolean {
    return file.name.endsWith(".fastq") || file.name.endsWith(".fastq.gz") || file.name.endsWith(".fq") || file.name.endsWith(".fq.gz");
}

/**
 * Groups filenames such that if two files differ by exactly one character
 * (specifically the digit after an "R", i.e. "R1" vs "R2"), they are paired together.
 *
 * @param files - The list of filenames.
 * @returns An object containing two arrays: `single` for unpaired filenames and
 *          `paired` for arrays of paired filenames.
 */
function groupPairEndReadFiles(files: File[]): ([File, File] | File )[] { 
  const result: ([File, File] | File )[] = [];
  const used: Set<number> = new Set();
  console.log(files);
  for (let i = 0; i < files.length; i++) {
    if (used.has(i)) continue;
    // if (!isFastqFile(files[i])) continue;
    let foundPair = false;
    for (let j = i + 1; j < files.length; j++) {
      if (used.has(j)) continue;
      if (!isFastqFile(files[j])) continue;
      if (isPair(files[i].name, files[j].name)) {
        // sort the pair so that the R1 file is always first
        if (files[i].name.includes("R1")) {
          result.push([files[i], files[j]]);
        } else {
          result.push([files[j], files[i]]);
        }
        used.add(i);
        used.add(j);
        foundPair = true;
        break;
      }
    }
    if (!foundPair) {
      result.push(files[i]);
      used.add(i);
    }
  }
  return result;
}

export { groupPairEndReadFiles };