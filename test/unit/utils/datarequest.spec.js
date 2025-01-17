import DataRequest from '../../../shepherd.js/src/utils//datarequest';

global.fetch = jest.fn();

describe('DataRequest', () => {
  const defaultOptions = [
    'apiKey_12345', 'https://api.shepherdpro.com'
  ];

  it('exists and creates an instance', () => {
    const requestInstance = new DataRequest(...defaultOptions);

    expect(DataRequest).toBeTruthy();
    expect(requestInstance).toBeInstanceOf(DataRequest);
  });

  it('returns an error if no apiKey is passed', () => {
    expect(() => new DataRequest()).toThrow(
      'Shepherd Pro: Missing required apiKey option.'
    );
  });
  it('returns an error if no apiPath is passed', () => {
    expect(() => new DataRequest(defaultOptions[0], null)).toThrow(
      'Shepherd Pro: Missing required apiPath option.'
    );
  });

  it('can use the dataRequester to sendEvents()', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => new Promise((resolve) => resolve({ data: {} }))
    });
    const dataRequester = new DataRequest(...defaultOptions);

    expect(typeof dataRequester.sendEvents).toBe('function');

    const data = await dataRequester.sendEvents({});

    expect(data).toMatchObject({});
  });
});