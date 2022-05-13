import extensions from '../';

const StarWarsMovies = extensions['data-sources']['example/star-wars-movie'];

test('lists fild with defined ID', async () => {
  const result = await StarWarsMovies(
    {
      dataSourceId: 'test',
      type: 'example/star-wars-movie',
      name: 'Test data source',
      configuration: { movieId: "ZmlsbXM6MQ==" },
    },
    {}
  );

  expect(result.dataSourcePayload.data.film.title).toBe("A New Hope");
});

export { }
