/** Routes the active dialog id to its component (one modal at a time). */
import { useDialogStore } from '../../stores/ui-stores';
import { WatermarkDialog, HeaderFooterDialog, BatesDialog, StampDialog } from './decoration-dialogs';
import {
  EncryptDialog, RemoveSecurityDialog, RedactDialog, SignDialog,
  VerifySignaturesDialog, PasswordPromptDialog
} from './security-dialogs';
import { ConvertExportDialog, CreatePdfDialog, CompressDialog, PdfaDialog, OcrDialog } from './convert-dialogs';
import {
  SplitDialog, MergeDialog, InsertPagesDialog, CropDialog, GoToPageDialog, CompareDialog, BatchDialog
} from './organize-dialogs';
import {
  SaveChangesDialog, SettingsDialog, ShortcutsDialog, AboutDialog, VersionHistoryDialog,
  TemplatePickerDialog, SignatureManagerDialog, MetadataEditDialog, AttachFileDialog,
  LinkDialog, FormFieldDialog, PluginManagerDialog, AuditLogDialog, DocumentPropertiesDialog
} from './app-dialogs';

export function DialogHost() {
  const open = useDialogStore((s) => s.open);
  if (!open) return null;
  switch (open) {
    case 'watermark': return <WatermarkDialog />;
    case 'header-footer': return <HeaderFooterDialog />;
    case 'bates': return <BatesDialog />;
    case 'stamp': return <StampDialog />;
    case 'encrypt': return <EncryptDialog />;
    case 'remove-security': return <RemoveSecurityDialog />;
    case 'redact': return <RedactDialog />;
    case 'sign': return <SignDialog />;
    case 'verify-signatures': return <VerifySignaturesDialog />;
    case 'password-prompt': return <PasswordPromptDialog />;
    case 'convert-export': return <ConvertExportDialog />;
    case 'create-pdf': return <CreatePdfDialog />;
    case 'compress': return <CompressDialog />;
    case 'pdfa': return <PdfaDialog />;
    case 'ocr': return <OcrDialog />;
    case 'split': return <SplitDialog />;
    case 'merge': return <MergeDialog />;
    case 'insert-pages': return <InsertPagesDialog />;
    case 'crop': return <CropDialog />;
    case 'go-to-page': return <GoToPageDialog />;
    case 'compare': return <CompareDialog />;
    case 'batch': return <BatchDialog />;
    case 'save-changes': return <SaveChangesDialog />;
    case 'settings': return <SettingsDialog />;
    case 'shortcuts': return <ShortcutsDialog />;
    case 'about': return <AboutDialog />;
    case 'version-history': return <VersionHistoryDialog />;
    case 'template-picker': return <TemplatePickerDialog />;
    case 'signature-manager': return <SignatureManagerDialog />;
    case 'metadata-edit': return <MetadataEditDialog />;
    case 'attach-file': return <AttachFileDialog />;
    case 'link': return <LinkDialog />;
    case 'form-field': return <FormFieldDialog />;
    case 'plugin-manager': return <PluginManagerDialog />;
    case 'audit-log': return <AuditLogDialog />;
    case 'document-properties': return <DocumentPropertiesDialog />;
    default: return null;
  }
}
