import { describe, it, expect } from 'vitest';
import { classifyFile, fileExtension } from '@renderer/services/file-classify';

describe('file classification (drag-and-drop / open)', () => {
  it('extracts extensions from names and full paths', () => {
    expect(fileExtension('report.PDF')).toBe('pdf');
    expect(fileExtension('C:\\Users\\me\\Documents\\contract.pdf')).toBe('pdf');
    expect(fileExtension('/home/me/photo.JPG')).toBe('jpg');
    expect(fileExtension('archive.tar.gz')).toBe('gz');
    expect(fileExtension('noextension')).toBe('');
  });

  it('classifies PDFs (case-insensitive)', () => {
    expect(classifyFile('a.pdf')).toBe('pdf');
    expect(classifyFile('/x/Y/Z.PDF')).toBe('pdf');
  });

  it('classifies images we can embed directly', () => {
    expect(classifyFile('scan.png')).toBe('image');
    expect(classifyFile('scan.jpg')).toBe('image');
    expect(classifyFile('scan.jpeg')).toBe('image');
  });

  it('classifies text and rtf for conversion', () => {
    expect(classifyFile('notes.txt')).toBe('text');
    expect(classifyFile('data.csv')).toBe('text');
    expect(classifyFile('readme.md')).toBe('text');
    expect(classifyFile('letter.rtf')).toBe('rtf');
  });

  it('marks everything else unsupported', () => {
    expect(classifyFile('sheet.xlsx')).toBe('unsupported');
    expect(classifyFile('image.gif')).toBe('unsupported');
    expect(classifyFile('archive.zip')).toBe('unsupported');
    expect(classifyFile('plain')).toBe('unsupported');
  });
});
