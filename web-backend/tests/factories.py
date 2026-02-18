"""
Test data factories using Faker for generating realistic test data.

This module provides factory functions that create test data with realistic
values using the Faker library. This makes tests more robust and helps catch
edge cases with varied data.

Usage:
    from tests.factories import BookFactory, CommodityFactory, AccountFactory

    # Create with defaults
    book = BookFactory.create(client)
    
    # Create with custom data
    book = BookFactory.create(client, name="Custom Book")
    
    # Build data without creating (for inspection)
    book_data = BookFactory.build(name="Preview Book")
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from faker import Faker

# Initialize Faker with consistent seed for reproducibility
# Use different seed in CI if needed: os.getenv("FAKER_SEED", "12345")
fake = Faker(["pt_BR", "en_US"])
Faker.seed(12345)


class BookFactory:
    """Factory for creating Book entities."""

    @staticmethod
    def build(name: str | None = None, **kwargs) -> dict[str, Any]:
        """Build book data without creating it.

        Args:
            name: Book name (default: generated company name)
            **kwargs: Additional fields to override

        Returns:
            Dictionary with book data
        """
        data = {
            "name": name or fake.company(),
        }
        data.update(kwargs)
        return data

    @staticmethod
    def create(client, name: str | None = None, **kwargs) -> str:
        """Create a book and return its ID.

        Args:
            client: FastAPI test client
            name: Book name (default: generated)
            **kwargs: Additional fields

        Returns:
            Book ID (string)
        """
        data = BookFactory.build(name=name, **kwargs)
        response = client.post("/books", json=data)
        assert response.status_code == 201, f"Failed to create book: {response.json()}"
        return response.json()["id"]

    @staticmethod
    def create_batch(client, count: int = 3, **kwargs) -> list[str]:
        """Create multiple books.

        Args:
            client: FastAPI test client
            count: Number of books to create
            **kwargs: Common fields for all books

        Returns:
            List of book IDs
        """
        return [BookFactory.create(client, **kwargs) for _ in range(count)]


class CommodityFactory:
    """Factory for creating Commodity entities (currencies)."""

    # Common currency codes for variety
    CURRENCIES = ["BRL", "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF"]

    @staticmethod
    def build(
        mnemonic: str | None = None,
        namespace: str = "CURRENCY",
        fullname: str | None = None,
        fraction: int = 100,
        quote: bool = False,
        **kwargs,
    ) -> dict[str, Any]:
        """Build commodity data without creating it.

        Args:
            mnemonic: Currency code (default: random from CURRENCIES)
            namespace: Commodity namespace
            fullname: Full name (default: generated)
            fraction: Smallest fraction
            quote: Whether commodity has quotes
            **kwargs: Additional fields

        Returns:
            Dictionary with commodity data
        """
        if mnemonic is None:
            mnemonic = fake.random_element(CommodityFactory.CURRENCIES)

        data = {
            "namespace": namespace,
            "mnemonic": mnemonic,
            "fullname": fullname or f"{mnemonic} - {fake.currency_name()}",
            "fraction": fraction,
            "quote": quote,
        }
        data.update(kwargs)
        return data

    @staticmethod
    def create(client, mnemonic: str | None = None, **kwargs) -> str:
        """Create a commodity and return its ID.

        Args:
            client: FastAPI test client
            mnemonic: Currency code (default: BRL)
            **kwargs: Additional fields

        Returns:
            Commodity ID (string)
        """
        # Default to BRL if not specified
        if mnemonic is None:
            mnemonic = "BRL"

        data = CommodityFactory.build(mnemonic=mnemonic, **kwargs)
        response = client.post("/commodities", json=data)
        assert response.status_code == 201, f"Failed to create commodity: {response.json()}"
        return response.json()["id"]

    @staticmethod
    def create_batch(client, count: int = 3, **kwargs) -> list[str]:
        """Create multiple commodities with different mnemonics.

        Args:
            client: FastAPI test client
            count: Number of commodities to create
            **kwargs: Common fields for all commodities

        Returns:
            List of commodity IDs
        """
        ids = []
        used_mnemonics = set()

        for i in range(count):
            # Ensure unique mnemonics
            mnemonic = CommodityFactory.CURRENCIES[i % len(CommodityFactory.CURRENCIES)]
            if mnemonic in used_mnemonics:
                mnemonic = f"TST{i:03d}"
            used_mnemonics.add(mnemonic)

            commodity_id = CommodityFactory.create(client, mnemonic=mnemonic, **kwargs)
            ids.append(commodity_id)

        return ids


class AccountFactory:
    """Factory for creating Account entities."""

    # Common account names by type
    ACCOUNT_NAMES = {
        "ASSET": ["Cash", "Bank Account", "Checking", "Savings", "Investments"],
        "LIABILITY": ["Credit Card", "Loan", "Mortgage", "Accounts Payable"],
        "EQUITY": ["Opening Balances", "Retained Earnings", "Owner's Equity"],
        "INCOME": ["Salary", "Interest", "Dividends", "Sales Revenue"],
        "EXPENSE": ["Groceries", "Rent", "Utilities", "Transportation", "Entertainment"],
    }

    @staticmethod
    def build(
        *,
        book_id: str,
        commodity_id: str,
        name: str | None = None,
        account_type: str = "ASSET",
        parent_id: str | None = None,
        is_placeholder: bool = False,
        code: str | None = None,
        description: str | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """Build account data without creating it.

        Args:
            book_id: Book ID this account belongs to
            commodity_id: Commodity ID
            name: Account name (default: generated based on type)
            account_type: Account type
            parent_id: Parent account ID
            is_placeholder: Whether this is a placeholder
            code: Account code
            description: Account description
            **kwargs: Additional fields

        Returns:
            Dictionary with account data
        """
        if name is None:
            names = AccountFactory.ACCOUNT_NAMES.get(account_type, ["Account"])
            name = fake.random_element(names)

        data = {
            "book_id": book_id,
            "name": name,
            "type": account_type,
            "commodity_id": commodity_id,
            "is_placeholder": is_placeholder,
        }

        if parent_id is not None:
            data["parent_id"] = parent_id
        if code is not None:
            data["code"] = code
        if description is not None:
            data["description"] = description

        data.update(kwargs)
        return data

    @staticmethod
    def create(
        client,
        *,
        book_id: str,
        commodity_id: str,
        name: str | None = None,
        account_type: str = "ASSET",
        parent_id: str | None = None,
        is_placeholder: bool = False,
        code: str | None = None,
        **kwargs,
    ) -> str:
        """Create an account and return its ID.

        Args:
            client: FastAPI test client
            book_id: Book ID
            commodity_id: Commodity ID
            name: Account name (default: generated)
            account_type: Account type
            parent_id: Parent account ID
            is_placeholder: Whether this is a placeholder
            code: Account code
            **kwargs: Additional fields

        Returns:
            Account ID (string)
        """
        data = AccountFactory.build(
            book_id=book_id,
            commodity_id=commodity_id,
            name=name,
            account_type=account_type,
            parent_id=parent_id,
            is_placeholder=is_placeholder,
            code=code,
            **kwargs,
        )
        response = client.post("/accounts", json=data)
        assert response.status_code == 201, f"Failed to create account: {response.json()}"
        return response.json()["id"]

    @staticmethod
    def create_root(client, *, book_id: str, commodity_id: str, name: str = "Root") -> str:
        """Create a root account.

        Args:
            client: FastAPI test client
            book_id: Book ID
            commodity_id: Commodity ID
            name: Account name

        Returns:
            Account ID (string)
        """
        return AccountFactory.create(
            client,
            book_id=book_id,
            commodity_id=commodity_id,
            name=name,
            account_type="ROOT",
            is_placeholder=True,
        )

    @staticmethod
    def create_batch(
        client,
        *,
        book_id: str,
        commodity_id: str,
        parent_id: str | None = None,
        count: int = 3,
        account_type: str = "ASSET",
        **kwargs,
    ) -> list[str]:
        """Create multiple accounts.

        Args:
            client: FastAPI test client
            book_id: Book ID
            commodity_id: Commodity ID
            parent_id: Parent account ID
            count: Number of accounts to create
            account_type: Account type for all
            **kwargs: Common fields

        Returns:
            List of account IDs
        """
        return [
            AccountFactory.create(
                client,
                book_id=book_id,
                commodity_id=commodity_id,
                parent_id=parent_id,
                account_type=account_type,
                **kwargs,
            )
            for _ in range(count)
        ]


class CustomerFactory:
    """Factory for creating Customer entities."""

    @staticmethod
    def build(
        *,
        book_id: str,
        currency_guid: str,
        name: str | None = None,
        customer_id: str | None = None,
        notes: str | None = None,
        active: bool = True,
        addr_name: str | None = None,
        addr_email: str | None = None,
        addr_phone: str | None = None,
        addr_addr1: str | None = None,
        addr_addr2: str | None = None,
        addr_addr3: str | None = None,
        addr_addr4: str | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """Build customer data without creating it.

        Args:
            book_id: Book ID
            currency_guid: Currency commodity GUID
            name: Customer name (default: generated company)
            customer_id: Customer ID code (default: generated)
            notes: Notes
            active: Whether customer is active
            addr_name: Contact name
            addr_email: Email
            addr_phone: Phone
            addr_addr1-4: Address lines
            **kwargs: Additional fields

        Returns:
            Dictionary with customer data
        """
        if name is None:
            name = fake.company()
        if customer_id is None:
            customer_id = f"C{fake.random_number(digits=4, fix_len=True)}"

        data = {
            "book_id": book_id,
            "currency_guid": currency_guid,
            "name": name,
            "id": customer_id,
            "active": active,
        }

        if notes is not None:
            data["notes"] = notes
        if addr_name is not None:
            data["addr_name"] = addr_name
        if addr_email is not None:
            data["addr_email"] = addr_email
        elif fake.boolean(chance_of_getting_true=70):
            data["addr_email"] = fake.company_email()
        if addr_phone is not None:
            data["addr_phone"] = addr_phone
        elif fake.boolean(chance_of_getting_true=60):
            data["addr_phone"] = fake.phone_number()
        if addr_addr1 is not None:
            data["addr_addr1"] = addr_addr1
        if addr_addr2 is not None:
            data["addr_addr2"] = addr_addr2
        if addr_addr3 is not None:
            data["addr_addr3"] = addr_addr3
        if addr_addr4 is not None:
            data["addr_addr4"] = addr_addr4

        data.update(kwargs)
        return data

    @staticmethod
    def create(
        client,
        *,
        book_id: str,
        currency_guid: str,
        name: str | None = None,
        customer_id: str | None = None,
        **kwargs,
    ) -> str:
        """Create a customer and return its GUID.

        Args:
            client: FastAPI test client
            book_id: Book ID
            currency_guid: Currency GUID
            name: Customer name (default: generated)
            customer_id: Customer ID code (default: generated)
            **kwargs: Additional fields

        Returns:
            Customer GUID (string)
        """
        data = CustomerFactory.build(
            book_id=book_id,
            currency_guid=currency_guid,
            name=name,
            customer_id=customer_id,
            **kwargs,
        )
        response = client.post("/customers", json=data)
        assert response.status_code == 201, f"Failed to create customer: {response.json()}"
        return response.json()["guid"]

    @staticmethod
    def create_batch(
        client,
        *,
        book_id: str,
        currency_guid: str,
        count: int = 3,
        **kwargs,
    ) -> list[str]:
        """Create multiple customers.

        Args:
            client: FastAPI test client
            book_id: Book ID
            currency_guid: Currency GUID
            count: Number of customers to create
            **kwargs: Common fields

        Returns:
            List of customer GUIDs
        """
        return [
            CustomerFactory.create(
                client,
                book_id=book_id,
                currency_guid=currency_guid,
                **kwargs,
            )
            for _ in range(count)
        ]


class VendorFactory:
    """Factory for creating Vendor entities."""

    @staticmethod
    def build(
        *,
        book_id: str,
        currency_guid: str,
        name: str | None = None,
        vendor_id: str | None = None,
        notes: str | None = None,
        active: bool = True,
        addr_name: str | None = None,
        addr_email: str | None = None,
        addr_phone: str | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """Build vendor data without creating it.

        Args:
            book_id: Book ID
            currency_guid: Currency GUID
            name: Vendor name (default: generated)
            vendor_id: Vendor ID code (default: generated)
            notes: Notes
            active: Whether vendor is active
            addr_name: Contact name
            addr_email: Email
            addr_phone: Phone
            **kwargs: Additional fields

        Returns:
            Dictionary with vendor data
        """
        if name is None:
            name = f"{fake.company()} {fake.random_element(['Inc.', 'Ltd.', 'Corp.', 'LLC'])}"
        if vendor_id is None:
            vendor_id = f"V{fake.random_number(digits=4, fix_len=True)}"

        data = {
            "book_id": book_id,
            "currency_guid": currency_guid,
            "name": name,
            "id": vendor_id,
            "active": active,
        }

        if notes is not None:
            data["notes"] = notes
        if addr_name is not None:
            data["addr_name"] = addr_name
        if addr_email is not None:
            data["addr_email"] = addr_email
        if addr_phone is not None:
            data["addr_phone"] = addr_phone

        data.update(kwargs)
        return data

    @staticmethod
    def create(
        client,
        *,
        book_id: str,
        currency_guid: str,
        name: str | None = None,
        vendor_id: str | None = None,
        **kwargs,
    ) -> str:
        """Create a vendor and return its GUID.

        Args:
            client: FastAPI test client
            book_id: Book ID
            currency_guid: Currency GUID
            name: Vendor name (default: generated)
            vendor_id: Vendor ID code (default: generated)
            **kwargs: Additional fields

        Returns:
            Vendor GUID (string)
        """
        data = VendorFactory.build(
            book_id=book_id,
            currency_guid=currency_guid,
            name=name,
            vendor_id=vendor_id,
            **kwargs,
        )
        response = client.post("/vendors", json=data)
        assert response.status_code == 201, f"Failed to create vendor: {response.json()}"
        return response.json()["guid"]

    @staticmethod
    def create_batch(
        client,
        *,
        book_id: str,
        currency_guid: str,
        count: int = 3,
        **kwargs,
    ) -> list[str]:
        """Create multiple vendors.

        Args:
            client: FastAPI test client
            book_id: Book ID
            currency_guid: Currency GUID
            count: Number of vendors to create
            **kwargs: Common fields

        Returns:
            List of vendor GUIDs
        """
        return [
            VendorFactory.create(
                client,
                book_id=book_id,
                currency_guid=currency_guid,
                **kwargs,
            )
            for _ in range(count)
        ]


class TransactionFactory:
    """Factory for creating Transaction entities."""

    @staticmethod
    def build(
        *,
        currency_guid: str,
        splits: list[dict[str, Any]],
        description: str | None = None,
        post_date: str | None = None,
        num: str | None = None,
        notes: str | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """Build transaction data without creating it.

        Args:
            currency_guid: Currency GUID
            splits: List of split dictionaries
            description: Transaction description (default: generated)
            post_date: Post date in ISO format
            num: Transaction number
            notes: Transaction notes
            **kwargs: Additional fields

        Returns:
            Dictionary with transaction data
        """
        if description is None:
            description = fake.sentence(nb_words=4)
        if post_date is None:
            # Random date in the last 90 days
            days_ago = fake.random_int(min=0, max=90)
            date = datetime.now() - timedelta(days=days_ago)
            post_date = date.isoformat()

        data = {
            "currency_guid": currency_guid,
            "description": description,
            "splits": splits,
        }

        if post_date is not None:
            data["post_date"] = post_date
        if num is not None:
            data["num"] = num
        if notes is not None:
            data["notes"] = notes

        data.update(kwargs)
        return data

    @staticmethod
    def create(
        client,
        *,
        currency_guid: str,
        account_id: str,
        counter_account_id: str,
        value_num: int,
        value_denom: int = 100,
        description: str | None = None,
        post_date: str | None = None,
        **kwargs,
    ) -> str:
        """Create a simple two-split transaction and return its GUID.

        Args:
            client: FastAPI test client
            currency_guid: Currency GUID
            account_id: First split account ID
            counter_account_id: Second split account ID (opposite sign)
            value_num: Value numerator
            value_denom: Value denominator
            description: Transaction description (default: generated)
            post_date: Post date
            **kwargs: Additional fields

        Returns:
            Transaction GUID (string)
        """
        splits = [
            {
                "account_guid": account_id,
                "memo": "",
                "action": "",
                "reconcile_state": "n",
                "value_num": value_num,
                "value_denom": value_denom,
                "quantity_num": value_num,
                "quantity_denom": value_denom,
            },
            {
                "account_guid": counter_account_id,
                "memo": "",
                "action": "",
                "reconcile_state": "n",
                "value_num": -value_num,
                "value_denom": value_denom,
                "quantity_num": -value_num,
                "quantity_denom": value_denom,
            },
        ]

        data = TransactionFactory.build(
            currency_guid=currency_guid,
            splits=splits,
            description=description,
            post_date=post_date,
            **kwargs,
        )

        response = client.post("/transactions", json=data)
        assert response.status_code == 201, f"Failed to create transaction: {response.json()}"
        return response.json()["guid"]

    @staticmethod
    def create_batch(
        client,
        *,
        currency_guid: str,
        account_id: str,
        counter_account_id: str,
        count: int = 3,
        value_range: tuple[int, int] = (1000, 100000),
        **kwargs,
    ) -> list[str]:
        """Create multiple transactions with random values.

        Args:
            client: FastAPI test client
            currency_guid: Currency GUID
            account_id: First split account ID
            counter_account_id: Second split account ID
            count: Number of transactions to create
            value_range: Tuple of (min, max) value_num
            **kwargs: Common fields

        Returns:
            List of transaction GUIDs
        """
        guids = []
        for _ in range(count):
            value_num = fake.random_int(min=value_range[0], max=value_range[1])
            guid = TransactionFactory.create(
                client,
                currency_guid=currency_guid,
                account_id=account_id,
                counter_account_id=counter_account_id,
                value_num=value_num,
                **kwargs,
            )
            guids.append(guid)
        return guids
