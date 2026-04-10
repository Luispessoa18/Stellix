import { Router } from 'express';

const router = Router();

router.get('/rates', async (_req, res) => {
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=BRL,EUR,GBP');
    const data = await response.json() as any;
    res.json({
      base: 'USD',
      rates: {
        USD: 1,
        BRL: Number(data?.rates?.BRL) || 0,
        EUR: Number(data?.rates?.EUR) || 0,
        GBP: Number(data?.rates?.GBP) || 0,
      },
    });
  } catch {
    res.json({
      base: 'USD',
      rates: {
        USD: 1,
        BRL: 0,
        EUR: 0,
        GBP: 0,
      },
    });
  }
});

export default router;
