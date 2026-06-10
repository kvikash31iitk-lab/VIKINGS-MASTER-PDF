/** Security dialogs: Encrypt, Remove Security, Redaction Center, Sign, Verify, Password prompt. */
import { useState } from 'react';
import { documentService } from '../../services/document-service';
import { redactionService } from '../../services/redaction-service';
import { ipc, IpcError } from '../../services/ipc';
import { useActiveDoc, useDocumentsStore } from '../../stores/documents-store';
import { useDialogStore, useRedactionStore, toast } from '../../stores/ui-stores';
import { useSettingsStore } from '../../stores/settings-store';
import { Modal } from '../common/Modal';
import { Button, Field, TextInput, Checkbox, RadioGroup, Spinner, EmptyState } from '../common/controls';
import { Icon } from '../common/Icon';
import { REDACTION_PATTERNS } from '@shared/constants';
import { baseName } from '../../utils';
import type { PdfPermissionFlags, SignatureVerificationResult } from '@shared/types';

export function EncryptDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const defaultAlg = useSettingsStore((s) => s.settings.security.defaultAlgorithm);
  const [algorithm, setAlgorithm] = useState<'aes-256' | 'aes-128'>(defaultAlg);
  const [userPassword, setUserPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [perms, setPerms] = useState<PdfPermissionFlags>({
    printing: true, copying: true, modifying: false, annotating: true, formFilling: true
  });
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  const apply = async (): Promise<void> => {
    if (userPassword !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (!userPassword && !ownerPassword) {
      toast.error('Set at least one password');
      return;
    }
    setBusy(true);
    try {
      await documentService.applyOperation(doc.id, 'Encrypt', (bytes) =>
        ipc.pdf.encrypt({ bytes, algorithm, userPassword, ownerPassword: ownerPassword || userPassword, permissions: perms })
      );
      useDocumentsStore.getState().update(doc.id, { encrypted: true });
      toast.success('Document encrypted', `${algorithm.toUpperCase()} — save to persist`);
      close();
    } finally {
      setBusy(false);
    }
  };

  const Perm = ({ id, label }: { id: keyof PdfPermissionFlags; label: string }) => (
    <Checkbox checked={perms[id]} onChange={(v) => setPerms({ ...perms, [id]: v })} label={label} />
  );

  return (
    <Modal title="Encrypt with Password" icon="lock" onClose={close} width={460}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void apply()} disabled={busy}>{busy ? 'Encrypting…' : 'Encrypt'}</Button></>}>
      <div className="flex flex-col gap-3">
        <Field label="Encryption algorithm">
          <RadioGroup value={algorithm} onChange={setAlgorithm} options={[
            { value: 'aes-256', label: 'AES-256', description: 'Strongest — PDF 2.0 (Acrobat X and newer)' },
            { value: 'aes-128', label: 'AES-128', description: 'Compatible with older readers (Acrobat 7+)' }
          ]} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Open password (user)"><TextInput type="password" value={userPassword} onChange={setUserPassword} /></Field>
          <Field label="Confirm"><TextInput type="password" value={confirm} onChange={setConfirm} /></Field>
        </div>
        <Field label="Permissions password (owner)" hint="Controls permission changes. Defaults to the open password.">
          <TextInput type="password" value={ownerPassword} onChange={setOwnerPassword} />
        </Field>
        <Field label="Allow users to">
          <div className="grid grid-cols-2 gap-1.5">
            <Perm id="printing" label="Print" />
            <Perm id="copying" label="Copy content" />
            <Perm id="modifying" label="Edit document" />
            <Perm id="annotating" label="Comment" />
            <Perm id="formFilling" label="Fill forms" />
          </div>
        </Field>
      </div>
    </Modal>
  );
}

export function RemoveSecurityDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  const apply = async (): Promise<void> => {
    setBusy(true);
    try {
      await documentService.applyOperation(doc.id, 'Remove security', (bytes) =>
        ipc.pdf.decrypt({ bytes, password })
      );
      useDocumentsStore.getState().update(doc.id, { encrypted: false });
      toast.success('Security removed', 'Save to persist the unprotected copy');
      close();
    } catch (e) {
      if (e instanceof IpcError && e.code === 'E_WRONG_PASSWORD') toast.error('Incorrect password');
      else throw e;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Remove Security" icon="unlock" onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void apply()} disabled={busy}>Remove</Button></>}>
      <Field label="Document password" hint="The user or owner password of this document.">
        <TextInput type="password" value={password} onChange={setPassword} autoFocus onEnter={() => void apply()} />
      </Field>
    </Modal>
  );
}

export function RedactDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const marks = useRedactionStore((s) => (doc ? s.byDoc[doc.id] ?? [] : []));
  const [query, setQuery] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  const markSearch = async (): Promise<void> => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const n = await redactionService.markSearch(doc.id, query, { regex: useRegex });
      toast.info(`${n} match region(s) marked`);
    } finally {
      setBusy(false);
    }
  };

  const markPatterns = async (): Promise<void> => {
    if (patterns.length === 0) return;
    setBusy(true);
    try {
      const n = await redactionService.markPatterns(doc.id, patterns);
      toast.info(`${n} pattern region(s) marked`);
    } finally {
      setBusy(false);
    }
  };

  const apply = async (): Promise<void> => {
    setBusy(true);
    try {
      await redactionService.apply(doc.id);
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Redaction Center" icon="redact" onClose={close} width={500}
      footer={
        <>
          <span className="mr-auto text-xs text-app-text-muted">{marks.length} pending mark(s)</span>
          <Button onClick={() => useRedactionStore.getState().clear(doc.id)} disabled={marks.length === 0}>Clear marks</Button>
          <Button variant="danger" onClick={() => void apply()} disabled={busy || marks.length === 0}>
            Apply — destroys content
          </Button>
        </>
      }>
      <div className="flex flex-col gap-4">
        <p className="rounded-md border border-app-warning/40 bg-app-surface-2 px-2.5 py-2 text-2xs text-app-text-muted">
          <strong>Applying redactions is permanent.</strong> Marked pages are re-rendered with the regions
          destroyed; original text and images beneath them are removed from the file.
        </p>
        <section>
          <h3 className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-app-text-faint">Mark by search</h3>
          <div className="flex gap-2">
            <TextInput value={query} onChange={setQuery} placeholder="Find text to redact…" onEnter={() => void markSearch()} />
            <Button onClick={() => void markSearch()} disabled={busy}>Mark</Button>
          </div>
          <div className="mt-1.5"><Checkbox checked={useRegex} onChange={setUseRegex} label="Regular expression" /></div>
        </section>
        <section>
          <h3 className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-app-text-faint">Mark by pattern</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {REDACTION_PATTERNS.map((p) => (
              <Checkbox key={p.id} checked={patterns.includes(p.id)} label={p.label}
                onChange={(v) => setPatterns(v ? [...patterns, p.id] : patterns.filter((x) => x !== p.id))} />
            ))}
          </div>
          <div className="mt-2"><Button onClick={() => void markPatterns()} disabled={busy || patterns.length === 0}>Mark patterns</Button></div>
        </section>
        <section>
          <h3 className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-app-text-faint">Mark manually</h3>
          <p className="text-2xs text-app-text-muted">
            Use <em>Protect ▸ Mark Areas</em> to drag rectangles over anything on the page.
          </p>
        </section>
      </div>
    </Modal>
  );
}

export function SignDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [p12Path, setP12Path] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [reason, setReason] = useState('');
  const [location, setLocation] = useState('');
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  const sign = async (): Promise<void> => {
    if (!p12Path) {
      toast.warning('Choose a certificate file (.p12 / .pfx)');
      return;
    }
    setBusy(true);
    try {
      const p12 = await ipc.files.read(p12Path);
      await documentService.applyOperation(doc.id, 'Digital signature', async (bytes) => {
        const runtime = documentService.runtime(doc.id);
        const page = await runtime!.pdf.getPage(doc.view.page);
        const vp = page.getViewport({ scale: 1 });
        return ipc.pdf.sign({
          bytes, p12, passphrase,
          ...(reason ? { reason } : {}),
          ...(location ? { location } : {}),
          ...(visible
            ? {
                visible: {
                  pageIndex: doc.view.page - 1,
                  rect: { x: vp.width - 220, y: 36, width: 180, height: 56 },
                  label: `Digitally signed${reason ? ` — ${reason}` : ''}`
                }
              }
            : {})
        });
      });
      useDocumentsStore.getState().update(doc.id, { signed: true });
      toast.success('Document signed', 'Save to persist the signed file');
      close();
    } catch (e) {
      toast.error('Signing failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Certificate Signature" icon="certificate" onClose={close} width={460}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void sign()} disabled={busy}>{busy ? 'Signing…' : 'Sign Document'}</Button></>}>
      <div className="flex flex-col gap-3">
        <Field label="PKCS#12 certificate (.p12 / .pfx)">
          <div className="flex gap-2">
            <TextInput value={p12Path ? baseName(p12Path) : ''} onChange={() => undefined} placeholder="Choose certificate…" disabled />
            <Button onClick={() => void ipc.files.openDialog({ filters: [{ name: 'Certificates', extensions: ['p12', 'pfx'] }] }).then((p) => p?.[0] && setP12Path(p[0]))}>
              Browse
            </Button>
          </div>
        </Field>
        <Field label="Certificate passphrase"><TextInput type="password" value={passphrase} onChange={setPassphrase} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reason (optional)"><TextInput value={reason} onChange={setReason} placeholder="Approval" /></Field>
          <Field label="Location (optional)"><TextInput value={location} onChange={setLocation} /></Field>
        </div>
        <Checkbox checked={visible} onChange={setVisible} label={`Show a visible signature on page ${doc.view.page}`} />
      </div>
    </Modal>
  );
}

export function VerifySignaturesDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [results, setResults] = useState<SignatureVerificationResult[] | null>(null);

  if (!doc) return null;
  if (results === null) {
    const runtime = documentService.runtime(doc.id);
    if (runtime) void ipc.pdf.verifySignatures(runtime.bytes).then(setResults).catch(() => setResults([]));
  }

  return (
    <Modal title="Signature Validation" icon="shield-check" onClose={close} width={520}
      footer={<Button onClick={close}>Close</Button>}>
      {results === null ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-app-text-muted"><Spinner /> Verifying…</div>
      ) : results.length === 0 ? (
        <EmptyState icon="signature" title="No digital signatures" hint="This document has not been certificate-signed." />
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((r, i) => (
            <div key={i} className="rounded-lg border border-app-border p-3">
              <div className="flex items-center gap-2">
                <Icon name={r.intact ? 'shield-check' : 'warning'} size={18}
                  className={r.intact ? 'text-app-success' : 'text-app-danger'} />
                <div className="flex-1">
                  <div className="text-sm font-semibold">{r.signerName}</div>
                  <div className="text-2xs text-app-text-muted">
                    {r.intact ? 'Signature valid — document unmodified since signing' : 'SIGNATURE INVALID'}
                    {!r.coversWholeDocument && ' · later revisions exist'}
                  </div>
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-[90px_1fr] gap-y-0.5 text-2xs">
                {r.signedAt && (<><dt className="text-app-text-faint">Signed</dt><dd className="select-text">{r.signedAt}</dd></>)}
                {r.reason && (<><dt className="text-app-text-faint">Reason</dt><dd className="select-text">{r.reason}</dd></>)}
                <dt className="text-app-text-faint">Subject</dt><dd className="select-text truncate" title={r.certificateSubject}>{r.certificateSubject}</dd>
                <dt className="text-app-text-faint">Issuer</dt><dd className="select-text truncate" title={r.certificateIssuer}>{r.certificateIssuer}</dd>
                <dt className="text-app-text-faint">Valid</dt>
                <dd>{new Date(r.certificateValidFrom).toLocaleDateString()} – {new Date(r.certificateValidTo).toLocaleDateString()}</dd>
              </dl>
              {r.errors.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-2xs text-app-danger">
                  {r.errors.map((e, j) => (<li key={j}>{e}</li>))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function PasswordPromptDialog() {
  const close = useDialogStore((s) => s.close);
  const payload = useDialogStore((s) => s.payload) as { path: string } | undefined;
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!payload) return null;

  const open = async (): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      await documentService.openFromPath(payload.path, password);
      close();
    } catch {
      setError('Incorrect password — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Password Required" icon="lock" onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void open()} disabled={busy}>Open</Button></>}>
      <div className="flex flex-col gap-2">
        <p className="text-xs text-app-text-muted">“{baseName(payload.path)}” is protected.</p>
        <Field label="Password">
          <TextInput type="password" value={password} onChange={setPassword} autoFocus onEnter={() => void open()} />
        </Field>
        {error && <p className="text-xs text-app-danger">{error}</p>}
      </div>
    </Modal>
  );
}
