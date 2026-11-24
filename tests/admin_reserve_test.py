"""Integration checks; requires an explicitly provisioned disposable account and session.

Run with: python3 -m unittest discover -s tests -p admin_reserve_test.py
The caller must remove fixture transactions, audit entries and reserve movements,
and return only the fixture's spent allocation after the checks.
"""
import json
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import requests


class AdminReserve(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.url = os.environ["VITE_SUPABASE_URL"] + "/rest/v1/"
        cls.key = os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
        cls.token = json.loads(os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"])["access_token"]
        cls.account = os.environ["RESERVE_TEST_ACCOUNT_ID"]
        fixture = cls.read("accounts", {"id": "eq." + cls.account})
        if len(fixture) != 1 or fixture[0]["account_name"] != "Reserve verification fixture":
            raise RuntimeError("Only a disposable reserve fixture may be tested")

    @classmethod
    def headers(cls, anonymous=False):
        return {"apikey": cls.key, "Authorization": "Bearer " + (cls.key if anonymous else cls.token)}

    @classmethod
    def read(cls, table, params=None):
        response = requests.get(cls.url + table, params=params, headers=cls.headers(), timeout=20)
        response.raise_for_status()
        return response.json()

    def rpc(self, name, args, anonymous=False):
        return requests.post(self.url + "rpc/" + name, json=args, headers=self.headers(anonymous), timeout=20)

    def available(self):
        return Decimal(str(self.read("admin_reserve")[0]["available_balance"]))

    def balance(self):
        return Decimal(str(self.read("accounts", {"id": "eq." + self.account})[0]["balance"]))

    def pending(self, amount):
        response = self.rpc("admin_post_pending_deposit", {
            "p_account": self.account, "p_amount": amount, "p_reason": "Reserve verification fixture"})
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_total_allocation_is_ten_billion_usd(self):
        self.assertEqual(Decimal(str(self.read("admin_reserve")[0]["total_allocation"])), Decimal("10000000000"))

    def test_admin_credit_deducts_same_amount_from_reserve(self):
        reserve, balance = self.available(), self.balance()
        r = self.rpc("admin_adjust_account_balance", {"p_account": self.account, "p_delta": 10, "p_note": "Reserve verification fixture"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.available(), reserve - 10)
        self.assertEqual(self.balance(), balance + 10)

    def test_pending_deposit_does_not_spend_until_completed(self):
        reserve, balance = self.available(), self.balance()
        self.pending(0.25)
        self.assertEqual(self.available(), reserve)
        self.assertEqual(self.balance(), balance)

    def test_completion_from_transaction_status_funds_deposit(self):
        tx = self.pending(20)
        reserve, balance = self.available(), self.balance()
        r = self.rpc("admin_update_transaction_status", {"p_tx": tx, "p_status": "completed"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.available(), reserve - 20)
        self.assertEqual(self.balance(), balance + 20)

    def test_repeated_completion_cannot_spend_twice(self):
        tx = self.pending(2)
        self.assertEqual(self.rpc("admin_complete_pending_deposit", {"p_tx": tx}).status_code, 200)
        reserve, balance = self.available(), self.balance()
        self.assertEqual(self.rpc("admin_complete_pending_deposit", {"p_tx": tx}).status_code, 400)
        self.assertEqual(self.available(), reserve)
        self.assertEqual(self.balance(), balance)

    def test_simultaneous_completion_cannot_spend_twice(self):
        tx = self.pending(3)
        reserve, balance = self.available(), self.balance()
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(lambda _: self.rpc("admin_complete_pending_deposit", {"p_tx": tx}).status_code, range(2)))
        self.assertEqual(sorted(statuses), [200, 400])
        self.assertEqual(self.available(), reserve - 3)
        self.assertEqual(self.balance(), balance + 3)

    def test_credit_amount_increase_spends_only_difference(self):
        tx = self.pending(1)
        self.assertEqual(self.rpc("admin_complete_pending_deposit", {"p_tx": tx}).status_code, 200)
        reserve, balance = self.available(), self.balance()
        r = self.rpc("admin_update_transaction_amount", {"p_tx": tx, "p_amount": 6})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.available(), reserve - 5)
        self.assertEqual(self.balance(), balance + 5)

    def test_insufficient_reserve_rolls_back_customer_credit(self):
        reserve, balance = self.available(), self.balance()
        r = self.rpc("admin_adjust_account_balance", {"p_account": self.account, "p_delta": 10000000001})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["message"], "Insufficient internal reserve funds")
        self.assertEqual(self.available(), reserve)
        self.assertEqual(self.balance(), balance)

    def test_reserve_cannot_be_changed_directly_by_browser(self):
        reserve = self.available()
        r = requests.patch(self.url + "admin_reserve?id=eq.1", json={"available_balance": 0}, headers={**self.headers(), "Prefer": "return=representation"}, timeout=20)
        self.assertIn(r.status_code, [200, 401, 403])
        if r.status_code == 200:
            self.assertEqual(r.json(), [])
        self.assertEqual(self.available(), reserve)

    def test_anonymous_cannot_fund_admin_credit(self):
        reserve = self.available()
        r = self.rpc("admin_adjust_account_balance", {"p_account": self.account, "p_delta": 1}, anonymous=True)
        self.assertIn(r.status_code, [400, 401, 403])
        self.assertEqual(self.available(), reserve)


if __name__ == "__main__":
    unittest.main()