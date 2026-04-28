import { imageFileFilter } from './storage';

function makeFile(mimetype: string): Express.Multer.File {
  return {
    mimetype,
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    size: 1024,
    destination: '',
    filename: '',
    path: '',
    buffer: Buffer.from(''),
    stream: null as any,
  };
}

describe('imageFileFilter', () => {
  const req = {};

  it('accepts image/jpeg', (done) => {
    imageFileFilter(req, makeFile('image/jpeg'), (err, accepted) => {
      expect(err).toBeNull();
      expect(accepted).toBe(true);
      done();
    });
  });

  it('accepts image/jpg', (done) => {
    imageFileFilter(req, makeFile('image/jpg'), (err, accepted) => {
      expect(err).toBeNull();
      expect(accepted).toBe(true);
      done();
    });
  });

  it('accepts image/png', (done) => {
    imageFileFilter(req, makeFile('image/png'), (err, accepted) => {
      expect(err).toBeNull();
      expect(accepted).toBe(true);
      done();
    });
  });

  it('accepts image/webp', (done) => {
    imageFileFilter(req, makeFile('image/webp'), (err, accepted) => {
      expect(err).toBeNull();
      expect(accepted).toBe(true);
      done();
    });
  });

  it('rejects application/pdf', (done) => {
    imageFileFilter(req, makeFile('application/pdf'), (err, accepted) => {
      expect(err).toBeInstanceOf(Error);
      expect(accepted).toBe(false);
      done();
    });
  });

  it('rejects text/plain', (done) => {
    imageFileFilter(req, makeFile('text/plain'), (err, accepted) => {
      expect(err).toBeInstanceOf(Error);
      expect(accepted).toBe(false);
      done();
    });
  });

  it('rejects video/mp4', (done) => {
    imageFileFilter(req, makeFile('video/mp4'), (err, accepted) => {
      expect(err).toBeInstanceOf(Error);
      expect(accepted).toBe(false);
      done();
    });
  });

  it('rejects empty mimetype', (done) => {
    imageFileFilter(req, makeFile(''), (err, accepted) => {
      expect(err).toBeInstanceOf(Error);
      expect(accepted).toBe(false);
      done();
    });
  });
});
