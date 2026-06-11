/** Data returned when a GitHub device-flow authorization is initiated. */
export type GithubDeviceStart = {
  deviceCode: string
  userCode: string
  /** Where the user types the code, e.g. https://github.com/login/device */
  verificationUri: string
  /** Seconds the main process should wait between token polls. */
  interval: number
  /** Seconds until the device code expires. */
  expiresIn: number
}
