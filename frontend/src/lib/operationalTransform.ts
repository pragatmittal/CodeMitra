/**
 * Operational Transformation (OT) implementation for real-time collaborative code editing
 * This handles concurrent edits from multiple users without conflicts
 */

export interface Operation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  length?: number;
  text?: string;
  userId: string;
  timestamp: number;
}

export interface TransformResult {
  operations: Operation[];
  transformed: Operation[];
}

export class OperationalTransform {
  private version: number = 0;
  private pendingOperations: Operation[] = [];

  /**
   * Transform operations to handle concurrent edits
   */
  transform(operation1: Operation, operation2: Operation): TransformResult {
    if (operation1.timestamp <= operation2.timestamp) {
      return this.transformOperation(operation1, operation2);
    } else {
      return this.transformOperation(operation2, operation1);
    }
  }

  /**
   * Transform operation1 against operation2
   */
  private transformOperation(operation1: Operation, operation2: Operation): TransformResult {
    const result: TransformResult = {
      operations: [operation1],
      transformed: []
    };

    switch (operation1.type) {
      case 'insert':
        result.transformed = this.transformInsert(operation1, operation2);
        break;
      case 'delete':
        result.transformed = this.transformDelete(operation1, operation2);
        break;
      case 'retain':
        result.transformed = this.transformRetain(operation1, operation2);
        break;
    }

    return result;
  }

  /**
   * Transform insert operation
   */
  private transformInsert(insertOp: Operation, otherOp: Operation): Operation[] {
    if (otherOp.type === 'insert') {
      // Both are inserts - order by position
      if (insertOp.position < otherOp.position) {
        return [insertOp];
      } else if (insertOp.position > otherOp.position) {
        // Adjust position for other user's insert
        return [{
          ...insertOp,
          position: insertOp.position + (otherOp.text?.length || 0)
        }];
      } else {
        // Same position - order by timestamp
        if (insertOp.timestamp < otherOp.timestamp) {
          return [insertOp];
        } else {
          return [{
            ...insertOp,
            position: insertOp.position + (otherOp.text?.length || 0)
          }];
        }
      }
    } else if (otherOp.type === 'delete') {
      // Insert vs Delete
      if (insertOp.position < otherOp.position) {
        return [insertOp];
      } else if (insertOp.position > otherOp.position + (otherOp.length || 0)) {
        // Insert after delete range
        return [{
          ...insertOp,
          position: insertOp.position - (otherOp.length || 0)
        }];
      } else {
        // Insert within delete range - adjust position
        return [{
          ...insertOp,
          position: otherOp.position
        }];
      }
    } else {
      // Insert vs Retain
      if (insertOp.position <= otherOp.position) {
        return [insertOp];
      } else {
        // Adjust position for retained content
        return [{
          ...insertOp,
          position: insertOp.position + (otherOp.length || 0)
        }];
      }
    }
  }

  /**
   * Transform delete operation
   */
  private transformDelete(deleteOp: Operation, otherOp: Operation): Operation[] {
    if (otherOp.type === 'insert') {
      // Delete vs Insert
      if (deleteOp.position < otherOp.position) {
        return [deleteOp];
      } else if (deleteOp.position > otherOp.position) {
        // Adjust position for insert
        return [{
          ...deleteOp,
          position: deleteOp.position + (otherOp.text?.length || 0)
        }];
      } else {
        // Delete at insert position - extend delete range
        return [{
          ...deleteOp,
          position: deleteOp.position,
          length: (deleteOp.length || 0) + (otherOp.text?.length || 0)
        }];
      }
    } else if (otherOp.type === 'delete') {
      // Both are deletes
      if (deleteOp.position + (deleteOp.length || 0) <= otherOp.position) {
        return [deleteOp];
      } else if (deleteOp.position >= otherOp.position + (otherOp.length || 0)) {
        // Adjust position for other delete
        return [{
          ...deleteOp,
          position: deleteOp.position - (otherOp.length || 0)
        }];
      } else {
        // Overlapping deletes - merge them
        const start = Math.min(deleteOp.position, otherOp.position);
        const end = Math.max(
          deleteOp.position + (deleteOp.length || 0),
          otherOp.position + (otherOp.length || 0)
        );
        return [{
          ...deleteOp,
          position: start,
          length: end - start
        }];
      }
    } else {
      // Delete vs Retain
      if (deleteOp.position + (deleteOp.length || 0) <= otherOp.position) {
        return [deleteOp];
      } else if (deleteOp.position >= otherOp.position + (otherOp.length || 0)) {
        // Adjust position for retained content
        return [{
          ...deleteOp,
          position: deleteOp.position - (otherOp.length || 0)
        }];
      } else {
        // Overlapping - adjust delete range
        const overlap = Math.min(
          deleteOp.length || 0,
          otherOp.position + (otherOp.length || 0) - deleteOp.position
        );
        return [{
          ...deleteOp,
          length: (deleteOp.length || 0) - overlap
        }];
      }
    }
  }

  /**
   * Transform retain operation
   */
  private transformRetain(retainOp: Operation, otherOp: Operation): Operation[] {
    if (otherOp.type === 'insert') {
      // Retain vs Insert
      if (retainOp.position < otherOp.position) {
        return [retainOp];
      } else {
        // Adjust position for insert
        return [{
          ...retainOp,
          position: retainOp.position + (otherOp.text?.length || 0)
        }];
      }
    } else if (otherOp.type === 'delete') {
      // Retain vs Delete
      if (retainOp.position + (retainOp.length || 0) <= otherOp.position) {
        return [retainOp];
      } else if (retainOp.position >= otherOp.position + (otherOp.length || 0)) {
        // Adjust position for delete
        return [{
          ...retainOp,
          position: retainOp.position - (otherOp.length || 0)
        }];
      } else {
        // Overlapping - split retain operation
        const before = otherOp.position - retainOp.position;
        const after = (retainOp.position + (retainOp.length || 0)) - (otherOp.position + (otherOp.length || 0));
        const operations: Operation[] = [];
        
        if (before > 0) {
          operations.push({
            ...retainOp,
            length: before
          });
        }
        
        if (after > 0) {
          operations.push({
            ...retainOp,
            position: otherOp.position,
            length: after
          });
        }
        
        return operations;
      }
    } else {
      // Both are retains
      if (retainOp.position + (retainOp.length || 0) <= otherOp.position) {
        return [retainOp];
      } else if (retainOp.position >= otherOp.position + (otherOp.length || 0)) {
        // Adjust position for other retain
        return [{
          ...retainOp,
          position: retainOp.position - (otherOp.length || 0)
        }];
      } else {
        // Overlapping - adjust retain
        const overlap = Math.min(
          retainOp.length || 0,
          otherOp.position + (otherOp.length || 0) - retainOp.position
        );
        return [{
          ...retainOp,
          length: (retainOp.length || 0) - overlap
        }];
      }
    }
  }

  /**
   * Apply operations to text
   */
  applyOperations(text: string, operations: Operation[]): string {
    let result = text;
    let offset = 0;

    // Sort operations by position
    const sortedOps = [...operations].sort((a, b) => a.position - b.position);

    for (const op of sortedOps) {
      const adjustedPosition = op.position + offset;

      switch (op.type) {
        case 'insert':
          if (op.text) {
            result = result.slice(0, adjustedPosition) + op.text + result.slice(adjustedPosition);
            offset += op.text.length;
          }
          break;
        case 'delete':
          if (op.length) {
            result = result.slice(0, adjustedPosition) + result.slice(adjustedPosition + op.length);
            offset -= op.length;
          }
          break;
        case 'retain':
          // No change to text, just validation
          if (adjustedPosition + (op.length || 0) > result.length) {
            throw new Error('Invalid retain operation: position out of bounds');
          }
          break;
      }
    }

    return result;
  }

  /**
   * Create operation from text change
   */
  createOperation(
    oldText: string,
    newText: string,
    userId: string,
    timestamp: number
  ): Operation[] {
    const operations: Operation[] = [];
    let i = 0;
    let j = 0;

    while (i < oldText.length || j < newText.length) {
      if (i < oldText.length && j < newText.length && oldText[i] === newText[j]) {
        // Same character - retain
        let retainLength = 0;
        while (i < oldText.length && j < newText.length && oldText[i] === newText[j]) {
          retainLength++;
          i++;
          j++;
        }
        if (retainLength > 0) {
          operations.push({
            type: 'retain',
            position: i - retainLength,
            length: retainLength,
            userId,
            timestamp
          });
        }
      } else if (j < newText.length) {
        // Insert new character
        operations.push({
          type: 'insert',
          position: i,
          text: newText[j],
          userId,
          timestamp
        });
        j++;
      } else if (i < oldText.length) {
        // Delete old character
        operations.push({
          type: 'delete',
          position: i,
          length: 1,
          userId,
          timestamp
        });
        i++;
      }
    }

    return operations;
  }

  /**
   * Get current version
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * Increment version
   */
  incrementVersion(): void {
    this.version++;
  }
}

// Export singleton instance
export const ot = new OperationalTransform();
