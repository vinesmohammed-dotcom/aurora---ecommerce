const mongoose = require("mongoose");

/**
 * Execute work inside a native MongoDB transaction if supported by the cluster/server topology,
 * or execute directly if running on a standalone instance without replication.
 *
 * @template T
 * @param {(session: import("mongoose").ClientSession | null) => Promise<T>} work
 * @returns {Promise<T>}
 */
async function runInTransaction(work) {
  let session = null;
  let isTransactionActive = false;

  try {
    const setName = mongoose.connection?.client?.topology?.description?.setName;
    const type = mongoose.connection?.client?.topology?.description?.type;
    const isReplicaOrSharded = Boolean(setName || type === "Sharded" || type === "ReplicaSetWithPrimary");

    if (isReplicaOrSharded) {
      session = await mongoose.startSession();
      session.startTransaction();
      isTransactionActive = true;
    }
  } catch {
    session = null;
    isTransactionActive = false;
  }

  try {
    const result = await work(isTransactionActive ? session : null);
    if (isTransactionActive && session) {
      await session.commitTransaction();
    }
    return result;
  } catch (error) {
    if (isTransactionActive && session) {
      try {
        await session.abortTransaction();
      } catch {
        // Ignore abort failure
      }
    }
    throw error;
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch {
        // Ignore endSession failure
      }
    }
  }
}

module.exports = { runInTransaction };
