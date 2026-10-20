"""Run with the managed preview session injected; performs no financial writes."""
import json
import os
import unittest
import requests

SESSION = json.loads(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])
URL = os.environ.get('VITE_SUPABASE_URL', 'https://fvrzpuxkehukgfjhjehh.supabase.co')
KEY = os.environ.get('VITE_SUPABASE_PUBLISHABLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2cnpwdXhrZWh1a2dmamhqZWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4OTE4MzEsImV4cCI6MjA3OTQ2NzgzMX0.FrhNRmEFRFTKz4VX2h2A6-wYDbwaKZ7IT9rFXuQfams')

class InvestmentPermissions(unittest.TestCase):
    def rpc(self, name, body, token):
        return requests.post(URL + '/rest/v1/rpc/' + name, json=body, headers={'apikey': KEY, 'Authorization': 'Bearer ' + token}, timeout=20)
    def test_signed_in_access(self):
        r = self.rpc('has_investment_access', {}, SESSION['access_token'])
        self.assertEqual(r.status_code, 200)
        self.assertIs(r.json(), True)
    def test_anonymous_access_denied(self):
        r = self.rpc('has_investment_access', {}, KEY)
        self.assertIn(r.status_code, (401, 403))
    def test_sale_to_unowned_account_denied(self):
        r = self.rpc('sell_coins', {'p_account':'00000000-0000-0000-0000-000000000002', 'p_symbol':'BOA', 'p_units':1, 'p_min_usd':0}, SESSION['access_token'])
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json().get('message'), 'Account not found')

if __name__ == '__main__':
    unittest.main()
