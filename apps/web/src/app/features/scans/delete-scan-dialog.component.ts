import { Component, EventEmitter, Input, Output } from "@angular/core";
import type { ScanSummary } from "@designdebt/shared";

@Component({
  selector: "dd-delete-scan-dialog",
  standalone: true,
  template: `
    @if (scan) {
      <div class="dialog-backdrop" role="presentation" (click)="cancel.emit()">
        <section
          class="dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-scan-title"
          (click)="$event.stopPropagation()"
        >
          <div class="dialog-icon" aria-hidden="true">!</div>
          <div>
            <p class="eyebrow">Delete Scan</p>
            <h2 id="delete-scan-title" style="margin:.2rem 0 .4rem;">Remove this scan?</h2>
            <p class="dialog-copy">
              This will permanently delete the scan record, findings, captured styles, and token proposals for
              <strong>{{ scan.rootUrl }}</strong>.
            </p>
            @if (error) {
              <p class="dialog-error">{{ error }}</p>
            }
          </div>

          <div class="dialog-actions">
            <button class="button secondary" type="button" (click)="cancel.emit()" [disabled]="deleting">
              Cancel
            </button>
            <button class="button danger" type="button" (click)="confirm.emit()" [disabled]="deleting">
              {{ deleting ? "Deleting..." : "Delete scan" }}
            </button>
          </div>
        </section>
      </div>
    }
  `,
})
export class DeleteScanDialogComponent {
  @Input() scan: ScanSummary | null = null;
  @Input() deleting = false;
  @Input() error: string | null = null;
  @Output() readonly cancel = new EventEmitter<void>();
  @Output() readonly confirm = new EventEmitter<void>();
}
