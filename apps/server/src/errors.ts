export class ProjectError extends Error {
  statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'ProjectError'
    this.statusCode = statusCode
  }
}
