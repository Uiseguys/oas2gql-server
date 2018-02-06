export default {
  Vehicle: {
    associatedDrivers: {
      operationId: 'getDriverById',
      resolveObject: (id) => ({ id })
    }
  },
  Driver: {
    associatedVehicles: {
      operationId: 'getVehicleById',
      resolveObject: (id) => ({ id })
    },
    logBook: {
      operationId: 'getLogById',
      resolveObject: (id) => ({ id })
    }
  }
}
