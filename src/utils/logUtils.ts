
// Utility functions for standardized logging throughout the application

/**
 * Log an informational message with consistent formatting
 * @param message The message to log
 * @param data Optional data to include with the log
 */
export const logInfo = (message: string, data?: any) => {
  if (data !== undefined) {
    console.log(`🔵 ${message}:`, data);
  } else {
    console.log(`🔵 ${message}`);
  }
};

/**
 * Log a warning message with consistent formatting
 * @param message The warning message to log
 * @param data Optional data to include with the warning
 */
export const logWarning = (message: string, data?: any) => {
  if (data !== undefined) {
    console.warn(`🟡 ${message}:`, data);
  } else {
    console.warn(`🟡 ${message}`);
  }
};

/**
 * Log an error message with consistent formatting
 * @param message The error message to log
 * @param error Optional error object or data to include
 */
export const logError = (message: string, error?: any) => {
  if (error !== undefined) {
    console.error(`🔴 ${message}:`, error);
  } else {
    console.error(`🔴 ${message}`);
  }
};

/**
 * Log a performance measurement
 * @param label The label for the performance measurement
 * @param startTime The start time from performance.now()
 */
export const logPerformance = (label: string, startTime: number) => {
  const duration = performance.now() - startTime;
  console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
};

/**
 * Create a performance logger that returns a function to end and log the measurement
 * @param label The label for the performance measurement
 * @returns Function that ends and logs the measurement when called
 */
export const startPerformanceLog = (label: string) => {
  const start = performance.now();
  return () => logPerformance(label, start);
};
