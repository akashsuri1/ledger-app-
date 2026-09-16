export class PartialTransactionSaveError extends Error {
  readonly transactionId: number;
  constructor(transactionId: number, operation: "created" | "updated", cause: unknown) {
    const reason = cause instanceof Error ? cause.message : "The attachment could not be uploaded.";
    super(`Transaction ${operation}, but its attachment was not saved: ${reason}`);
    this.name = "PartialTransactionSaveError";
    this.transactionId = transactionId;
  }
}
