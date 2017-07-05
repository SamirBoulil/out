var utils = {

  // args takes a JSON stringify'd string and returns an object,
  // fails silently returning an empty object
  unmarshall: (str) => {
    try {
      return JSON.parse(str)
    } catch (ex) {
      console.error(`Error unmarshalling ${str}`, ex)
      return {}
    }
  },

  marshall: JSON.stringify,

  objectToArray: (objectKeyValues) => {
    var res = [];

    for (var key in objectKeyValues) {
      if (objectKeyValues.hasOwnProperty(key)) {
        res.push(objectKeyValues[key]);
      }
    }

    return res;
  }
}

module.exports = utils;
